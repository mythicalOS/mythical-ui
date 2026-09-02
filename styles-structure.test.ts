// styles-structure.test.ts — a workspace-level guard that every stylesheet this repo PUBLISHES
// is structurally intact.
//
// CSS fails silently by design. A browser that meets a malformed construct discards tokens until
// it can resync, and says nothing. That makes a one-character slip in a hand-maintained sheet the
// most expensive class of defect here, because none of the assertions this repo already has can
// see it: every CSS test in these packages reads the sheet as TEXT — regexing class names, token
// references, copy — and a class name is still present in the file whether or not the rule
// containing it survives parsing.
//
// It has now happened three times, each shipped green:
//
//   ec36eb0 (0.3.1) — a backtick inside the <mythical-select> stylesheet closed the JS template
//                     literal the sheet lives in; the module stopped parsing. Guarded by
//                     packages/ui-core/test/select-parses.test.ts (a real import + a backtick ban).
//   6c50c90 (0.3.2) — a rebase dropped a section banner's opening `/*`, so a paragraph of English
//                     prose became declarations and the terminator that followed was orphaned.
//                     Guarded by a comment-balance walk — which this file now owns (see below).
//   843254a         — a new section was appended directly after `.my-pop-trigger:focus-visible`
//                     and that rule's closing `}` was lost. Brace depth was 1 at EOF from then on.
//                     EVERYTHING after it — the rest of ui-core, all of @mythicalos/shell, and
//                     every consumer rule concatenated downstream — was swallowed by that one open
//                     rule and never applied. The comment guard added the commit before did not
//                     look at braces, so it sailed through.
//
// The pattern is the same each time and the lesson is the same each time: the guard has to be
// structural, and it has to cover EVERY published sheet, not the one that broke last. So this file
// lives at the workspace root (like dist-freshness.test.ts) rather than inside one package, walks
// every stylesheet the packages ship, and does the comment checks in the SAME pass as the brace
// checks. There is no separate styles-comments test: this file carries those checks, and they
// cover shell and the embedded select sheet too.
//
// It runs in the repo's normal path: root `bun test`, which is CI's "Unit tests" step (ci.yml) and
// the pre-publish step of release.yml, so no tag can publish a sheet that fails this.
//
// ── What the walk understands, and what it does not ──────────────────────────────────────────
//
// It is a tokenizer, not a CSS parser. One left-to-right pass with three lexical states — normal,
// inside a `/* */` comment, inside a `'` or `"` string — plus opaque `url(…)` spans. Braces,
// semicolons and quotes are counted ONLY in the normal state, so:
//
//   • a `{`, `}` or `;` inside a comment is not counted            /* like { this } */
//   • a `{`, `}` or `;` inside a string is not counted             content: "}";
//   • an apostrophe inside a comment does not open a string        /* the panel's width */
//   • a `/*` inside a string does not open a comment               content: "/*";
//   • `url(` runs to its `)` opaquely, so an unquoted data URI's braces are not counted
//   • `\` escapes the next character inside a string               content: "\"";
//
// It does NOT handle: CSS identifier escapes outside strings (`\7B` for `{`), which no sheet here
// uses; CSS nesting (`&`), which no sheet here uses and which the nesting check below would
// reject if one started — deliberately, as a tripwire rather than a silent allowance; and it makes
// no judgement about whether a property or value is real. Those are out of scope: this guard is
// about a sheet's SHAPE, not its content.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = import.meta.dir;
const PACKAGES_DIR = join(ROOT, "packages");

// ── the walk ────────────────────────────────────────────────────────────────────────────────
import { countCommentDelimiters, scanStylesheet, type Anomaly } from "./scripts/css-structure";


// ── discovery: every sheet the packages publish ─────────────────────────────────────────────

type Sheet = { id: string; read: () => string };

/** `.css` paths a package DECLARES it publishes — from `files` and from the `exports` map. */
function declaredCss(pkg: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.toLowerCase().endsWith(".css")) found.add(v.replace(/^\.\//, ""));
      return;
    }
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") return Object.values(v).forEach(walk);
  };
  walk(pkg.files);
  walk(pkg.exports);
  return [...found];
}

/** Every `.css` file physically present in a package (excluding build output / deps). */
function cssFilesOnDisk(dir: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist" || e.name.startsWith(".")) continue;
    const r = rel ? join(rel, e.name) : e.name;
    if (e.isDirectory()) out.push(...cssFilesOnDisk(dir, r));
    else if (e.name.toLowerCase().endsWith(".css")) out.push(r);
  }
  return out;
}

const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(PACKAGES_DIR, e.name, "package.json")))
  .map((e) => e.name)
  .sort();

const sheets: Sheet[] = [];
const checked = new Set<string>(); // repo-relative paths, so discovery cannot double-add
/** declared-but-missing published CSS, reported as its own failure rather than silently skipped */
const missingDeclared: string[] = [];
/** declared published CSS that discovery did NOT end up walking — a silent coverage hole */
const uncheckedDeclared: string[] = [];

const addSheet = (abs: string, id = relative(ROOT, abs)) => {
  if (checked.has(id)) return;
  checked.add(id);
  sheets.push({ id, read: () => readFileSync(abs, "utf8") });
};

for (const name of packageDirs) {
  const dir = join(PACKAGES_DIR, name);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<string, unknown>;
  // Check every sheet on disk, not only the declared ones: a sheet that is not published today
  // still ships the moment someone adds it to `files`, and the cost of checking it is nil.
  for (const rel of cssFilesOnDisk(dir).sort()) addSheet(join(dir, rel));
  // Then reconcile against what the manifest says is PUBLISHED. The disk walk skips dist/ and
  // dot-directories, so a package that published a generated sheet from there would otherwise
  // sail past this guard entirely — the coverage would be silently narrower than it reads.
  for (const declared of declaredCss(pkg)) {
    const abs = join(dir, declared);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      missingDeclared.push(`${name}/${declared}`);
      continue;
    }
    if (!checked.has(relative(ROOT, abs))) {
      uncheckedDeclared.push(`${name}/${declared}`);
      addSheet(abs); // check it anyway — the reconciliation test below reports the gap separately
    }
  }
}

// The <mythical-select> stylesheet is published too — it just lives inside a JS template literal
// in a shipped file (packages/ui-core/src/select is in that package's `files`). It is CSS a
// consumer's browser parses, so it gets the same walk. Bounded exactly the way the component
// itself and select-parses.test.ts bound it: from `:host{` to the literal's closing backtick.
const SELECT_JS = join(PACKAGES_DIR, "ui-core", "src", "select", "mythical-select.js");
if (existsSync(SELECT_JS)) {
  sheets.push({
    id: `${relative(ROOT, SELECT_JS)} (embedded stylesheet)`,
    read: () => {
      const source = readFileSync(SELECT_JS, "utf8");
      const start = source.indexOf(":host{");
      if (start === -1) throw new Error(`${SELECT_JS}: could not locate the embedded sheet (no ':host{')`);
      const end = source.indexOf("`", start);
      return source.slice(start, end === -1 ? undefined : end);
    },
  });
}

// ── the tests ───────────────────────────────────────────────────────────────────────────────

describe("published stylesheets are structurally intact", () => {
  test("every package's declared .css actually exists", () => {
    expect(
      missingDeclared,
      `package.json publishes ${missingDeclared.join(", ")}, but the file is not there — ` +
        `the published tarball would carry a broken exports map.`,
    ).toEqual([]);
  });

  // A guard that discovers nothing passes every assertion below it. Pin the sheets this repo is
  // KNOWN to publish so a rename, a moved file or a broken glob fails here loudly instead of
  // quietly reducing coverage to zero.
  test("discovery found the sheets this repo is known to publish", () => {
    const ids = sheets.map((s) => s.id);
    expect(ids).toContain("packages/ui-core/styles.css");
    expect(ids).toContain("packages/shell/styles.css");
    expect(ids.some((id) => id.includes("mythical-select.js"))).toBe(true);
    expect(sheets.length).toBeGreaterThanOrEqual(3);
  });

  test("every declared-published .css was actually walked", () => {
    expect(
      uncheckedDeclared,
      `these are published but the on-disk discovery skipped them (dist/ or a dot-directory) — ` +
        `they were checked as a fallback, but the discovery rule needs widening: ${uncheckedDeclared.join(", ")}`,
    ).toEqual([]);
  });

  for (const sheet of sheets) {
    test(`${sheet.id} — braces, comments and nesting are sound`, () => {
      const anomalies = scanStylesheet(sheet.read());
      // Structural damage CASCADES: one lost `}` makes every rule after it look nested. Assert on
      // a capped summary so the failure names the FIRST cause instead of burying it under
      // hundreds of consequences.
      const HEAD = 3;
      const summary = anomalies.slice(0, HEAD).map((a) => `line ${a.line}: ${a.kind}`);
      if (anomalies.length > HEAD) {
        summary.push(`…and ${anomalies.length - HEAD} more (later ones usually cascade from the first)`);
      }
      const report = anomalies
        .slice(0, HEAD)
        .map((a) => `  line ${a.line}: ${a.kind}\n    ${a.detail}`)
        .join("\n");
      expect(
        summary,
        anomalies.length
          ? `${sheet.id} is structurally broken (${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}; ` +
            `first ${Math.min(HEAD, anomalies.length)} shown — FIX THE FIRST ONE):\n${report}`
          : "",
      ).toEqual([]);
    });

    // Kept from the guard added in 6c50c90 alongside the walk above: the walk finds the FIRST
    // anomaly of each kind in order, while a raw count catches a pathological case where two
    // errors cancel out in the state machine but the sheet is still wrong.
    test(`${sheet.id} — comment openers and terminators balance in count`, () => {
      const src = sheet.read();
      const { opens, closes } = countCommentDelimiters(src);
      expect(opens, `${opens} openers vs ${closes} terminators — a banner lost its /* or its */`).toBe(closes);
    });
  }
});

// ── the guard's own tests ───────────────────────────────────────────────────────────────────
//
// A guard nobody has seen fail is a guess. These feed the walk each defect it exists to catch —
// including the three that actually shipped from this repo — and each near-miss it must NOT
// flag. Without them a refactor could quietly turn the walk into a function that always returns
// [], and every test above would still be green.

describe("the walk catches the defects it exists for", () => {
  const kinds = (css: string) => scanStylesheet(css).map((a) => a.kind);

  test("a lost `}` — the 843254a defect, reduced", () => {
    // The real shape: a rule loses its brace and the next section is swallowed whole.
    const css = [
      ".my-pop-trigger:focus-visible {",
      "  outline: 2px solid var(--my-accent); outline-offset: 2px;",
      "",
      "/* ── next section ── */",
      ".my-files__rail { display: flex; }",
    ].join("\n");
    const found = scanStylesheet(css);
    expect(found.map((a) => a.kind)).toContain("unclosed block at end of file");
    expect(found.map((a) => a.kind)).toContain("rule nested inside a rule");
    // and it points at the rule that actually lost the brace, not at the victim
    expect(found.find((a) => a.kind === "unclosed block at end of file")?.line).toBe(1);
  });

  test("a lost `}` that a stray `}` rebalances — brace COUNTS are equal, sheet is still broken", () => {
    // This is why counting is the floor and not the ceiling: 2 opens, 2 closes, depth 0 at EOF,
    // never negative — and `.b` is nevertheless trapped inside `.a` and never applies.
    const css = ".a { color: red;\n.b { color: blue; }\n}\n";
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
    expect(kinds(css)).toEqual(["rule nested inside a rule"]);
  });

  test("a lost `/*` — the 6c50c90 defect, reduced", () => {
    const css = "  a banner whose opener was dropped */\n.a { color: red; }\n";
    expect(kinds(css)).toContain("terminator outside a comment");
  });

  test("a lost `*/` swallows the rest of the sheet", () => {
    expect(kinds("/* a banner that never closes\n.a { color: red; }\n")).toContain("unterminated comment");
  });

  test("a `/*` inside a comment (the `*/` before it went missing)", () => {
    expect(kinds("/* one /* two */\n")).toContain("opener inside a comment");
  });

  test("a `}` with nothing open", () => {
    expect(kinds(".a { color: red; } }\n")).toContain("closing brace with no open block");
  });

  test("a declaration stranded at top level", () => {
    expect(kinds("color: red;\n.a { color: blue; }\n")).toContain("declaration outside any rule");
  });

  test("a string that never closes", () => {
    expect(kinds('.a::after { content: "unclosed; }\n')).toContain("unterminated string");
  });

  test("a url( that never closes — otherwise the opaque span would swallow the sheet silently", () => {
    expect(kinds(".a { background: url(data:image/svg+xml,x ; }\n.b { color: red; }\n")).toContain(
      "unterminated url(",
    );
  });
});

describe("the walk does not false-alarm on valid CSS", () => {
  const clean = (css: string) => expect(scanStylesheet(css)).toEqual([]);

  test("braces and semicolons inside a comment are not structure", () => {
    clean("/* .a { color: red; } and a stray } here */\n.b { color: blue; }\n");
  });

  test("braces inside a string are not structure", () => {
    clean('.a::before { content: "}{;"; }\n');
  });

  test("an apostrophe in comment prose does not open a string", () => {
    clean("/* the panel's width — it's fine */\n.a { color: red; }\n");
  });

  test("escaped quotes inside a string", () => {
    clean('.a::before { content: "\\""; }\n');
  });

  test("at-rules legitimately nest a rule", () => {
    clean("@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }\n");
    clean("@keyframes my-spin { to { transform: rotate(360deg); } }\n");
    clean("@supports (display: grid) { @media screen { .a { color: red; } } }\n");
  });

  test("a top-level at-statement is not a stranded declaration", () => {
    clean('@charset "utf-8";\n@import url("x.css");\n.a { color: red; }\n');
  });

  test("an unquoted data URI's braces and semicolons are opaque", () => {
    clean(".a { background: url(data:image/svg+xml;utf8,<svg>{}</svg>); }\n");
  });
});

// ── the comment COUNT is string- and url()-aware ────────────────────────────────────────────
// The count exists to catch a pathological pair of mistakes that cancel out inside the walk's
// state machine. It used to be a raw `src.match(/\/\*​/g)` count, which fails on perfectly valid
// CSS and would block a legitimate release — both cases below were found by the codex gate.
describe("comment counting does not false-alarm on valid CSS", () => {
  const count = (src: string) => {
    const { opens, closes } = countCommentDelimiters(src);
    return `${opens}/${closes}`;
  };

  test("a comment delimiter inside a string is not a delimiter", () => {
    expect(count('.x::before { content: "/*"; }')).toBe("0/0");
  });

  test("an escaped quote does not end the string, so a following /* stays inside it", () => {
    expect(count('.x::before { content: "a\\"/*"; }')).toBe("0/0");
  });

  test("an escaped BACKSLASH does end the string, so a following /* is real", () => {
    expect(count('.x::before { content: "a\\\\"/*"; }')).toBe("1/0");
  });

  test("an unquoted data URI's /* is opaque", () => {
    expect(count(".a { background: url(data:image/svg+xml;utf8,/*); }")).toBe("0/0");
  });

  test("a QUOTED url() argument may contain both ) and /*", () => {
    // Stopping at the first `)` would resume scanning mid-string and miscount what follows.
    expect(count('.a { background: URL("x)/*"); }')).toBe("0/0");
  });

  test("a single-quoted url() with surrounding space", () => {
    expect(count(".a { background: url( 'y)/*' ); }")).toBe("0/0");
  });

  test("a quote inside a comment does not open a string", () => {
    expect(count("/* it's fine */ .b{}")).toBe("1/1");
  });

  test("real comments still count, and an unterminated one is visible", () => {
    expect(count("/* a */ .b{}")).toBe("1/1");
    expect(count("/* a")).toBe("1/0");
  });
});

// ── url() edge cases the gate must get right in BOTH directions ─────────────────────────────
// Both found by the codex gate. A false POSITIVE here blocks a valid release; a false NEGATIVE
// lets malformed CSS ship — which is the whole point of the file.
describe("url() spans are opaque without becoming a blind spot", () => {
  test("an unterminated quoted url() is reported, not silently accepted", () => {
    // A raw newline does end a CSS string. The quoted-url loop bails there — but before this was
    // fixed it bailed SILENTLY, and the outer paren loop then accepted the later `)`, so a
    // malformed sheet scanned clean.
    const anomalies = scanStylesheet('.a{background:url("x\n);}.b{color:red}');
    expect(anomalies.map((a) => a.kind)).toContain("unterminated string in url()");
  });

  test("a VALID quoted url() whose argument contains ) and /* is not an anomaly", () => {
    expect(scanStylesheet('.a { background: URL("x)/*"); }')).toEqual([]);
  });
});
