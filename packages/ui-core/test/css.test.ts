// test/css.test.ts — the package's component stylesheet. styles.css ships the atom
// classes that src/logic/ derives (buttonClass, chipClass, statusLineClass, bannerClass,
// gaugeTone) and that both the Preact and React bindings render, so this guards:
//   (a) zero hard-coded hex colors outside CSS comments (everything visual is a --my-* token),
//   (b) zero raw `px` font-size values in the NEW "additions" section (see scoping note below),
//   (c) every --my-* token *referenced* here actually exists in the canonical tokens.css — this
//       is the regression test for the "design-export's tokens.css is v0.4-era/stale" fidelity
//       check (e.g. it would have caught the .my-gauge__track / .my-search__input remaps),
//   (d) none of the later-task shell classes (topbar/switcher/nav/split/rail/settings/iconbtn/
//       app/page/menu/logo) leak in here — this package owns atoms only,
// (e) every class the logic modules actually emit has a real selector in this file.
//
// Scoping note on (b): styles.css has two sections — a BASE that is the internal Preact atoms
// package's shipped,
// already-gated atom sheet taken verbatim (per the task, its class names and rules are not to be
// touched), and an ADDITIONS section newly authored/extracted for this task. The base predates
// the font-size-must-be-a-token discipline and is full of fine-tuned literal px sizes (11px,
// 12.5px, 13px, …) that don't sit on the --my-fs-* scale — rewriting them would violate the
// "take wholesale, don't rename/modify" instruction. So (b) is scoped to the additions section,
// which this task fully controls and which now tokenizes every font-size declaration.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bannerClass,
  buttonClass,
  chipClass,
  gaugeTone,
  statusLineClass,
  CHIP_SIZES,
  CHIP_TONES,
  type BannerTone,
  type BtnVariant,
  type StatusTone,
} from "../src/index.ts";

const stylesPath = join(import.meta.dir, "..", "styles.css");
const tokensPath = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "mythical-design",
  "tokens.css",
);

const css = readFileSync(stylesPath, "utf8");
const tokensCss = readFileSync(tokensPath, "utf8");

const ADDITIONS_MARKER = "/* @section: additions */";

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function additionsSlice(text: string): string {
  const idx = text.indexOf(ADDITIONS_MARKER);
  if (idx === -1) throw new Error(`ADDITIONS_MARKER not found in styles.css — expected "${ADDITIONS_MARKER}"`);
  return text.slice(idx);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `css` has a real, standalone selector occurrence of `.className` — i.e. not just a
 * prefix of some longer class (`.btn` must not match only inside `.btn--pri`). */
function hasClassSelector(cssText: string, className: string): boolean {
  const re = new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`);
  return re.test(cssText);
}

describe("styles.css — (a) zero hard-coded hex colors outside comments", () => {
  test("no #hex color literal appears outside a CSS comment", () => {
    const stripped = stripComments(css);
    const hexMatches = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
  });

  test("sanity: the known historical hex literals DO still exist, but only inside comments", () => {
    // Guards against the stripComments() helper silently no-op-ing (a false-negative trap).
    expect(css).toContain("#0A0C10");
    expect(css).toContain("#C9C3B6");
  });
});

describe("styles.css — (b) additions section: zero raw px font-size values", () => {
  test("every font-size declaration in the additions section uses a var(--my-fs-*) token", () => {
    const additions = additionsSlice(css);
    const rawPxFontSizes = additions.match(/font-size:\s*[\d.]+px/g) ?? [];
    expect(rawPxFontSizes).toEqual([]);
  });

  test("the additions section is non-empty (the scan itself is meaningful)", () => {
    const additions = additionsSlice(css);
    expect(additions.length).toBeGreaterThan(500);
  });
});

describe("styles.css — (c) every referenced --my-* token exists in the canonical tokens.css", () => {
  const definedTokens = new Set(
    Array.from(stripComments(tokensCss).matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]),
  );

  test("the canonical tokens.css actually defines a non-trivial set of tokens (sanity)", () => {
    expect(definedTokens.size).toBeGreaterThan(20);
  });

  test("every var(--my-*) reference in styles.css resolves to a defined canonical token", () => {
    const referenced = new Set(
      Array.from(css.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]),
    );
    const missing = Array.from(referenced).filter((name) => !definedTokens.has(name)).sort();
    expect(missing).toEqual([]);
  });

  test("regression guard: .my-chip uses var(--my-fs-micro) for font-size", () => {
    const chipRuleMatch = css.match(/\.my-chip\s*\{[^}]*font-size:\s*([^;]+)/);
    expect(chipRuleMatch).not.toBeNull();
    expect(chipRuleMatch?.[1]?.trim()).toBe("var(--my-fs-micro)");
  });

  // `.mono` (0,1,0) is declared near the top of this sheet; `.input` (also 0,1,0) is declared far
  // below it and sets the `font` SHORTHAND, which resets font-family. At equal specificity the
  // later rule wins, so `<input class="input mono">` silently lost its monospace face — visible
  // only in a consumer that did NOT happen to re-declare `.mono` after this sheet. The fix is the
  // (0,2,0) `.input.mono` restatement; this pins it so the shorthand can never re-win.
  test("regression guard: a mono input keeps the mono family despite .input's font shorthand", () => {
    const inputMono = css.match(/\.input\.mono\s*\{([^}]*)\}/);
    expect(inputMono).not.toBeNull();
    expect(inputMono?.[1]).toContain("font-family: var(--my-font-mono)");

    // The fix only works if it comes AFTER the `.input { … font: inherit … }` rule.
    const shorthandIdx = css.search(/\.input\s*\{[^}]*font:\s*inherit/);
    expect(shorthandIdx).toBeGreaterThan(-1);
    expect(css.indexOf(".input.mono")).toBeGreaterThan(shorthandIdx);
  });
});

describe("styles.css — (d) no later-task shell classes leak into this atom sheet", () => {
  const forbiddenPrefixes = [
    "my-topbar",
    "my-switcher",
    "my-nav",
    "my-split",
    "my-rail",
    "my-settings",
    "my-iconbtn",
    "my-app",
    "my-page",
    "my-menu",
    "my-logo",
  ];

  test.each(forbiddenPrefixes)("does not define .%s*", (prefix) => {
    expect(css.includes(`.${prefix}`)).toBe(false);
  });
});

describe("styles.css — (e) every class Task 2's logic emits exists as a selector", () => {
  // Coverage runs against the COMMENT-STRIPPED sheet. A prose mention is not a rule: this sheet
  // documents several of its own selectors by name (e.g. the chip block's note on why
  // `.my-chip--outline` may use --my-border), and matching that prose would let a DELETED
  // selector still satisfy its own coverage check — a component shipped invisible, gate green.
  const cssCode = stripComments(css);

  function expectSelectorsFor(classString: string) {
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      expect({ token, found: hasClassSelector(cssCode, token) }).toEqual({ token, found: true });
    }
  }

  test("the strip is real — a selector named ONLY in prose does not satisfy coverage", () => {
    // Guards the guard: if stripComments() ever no-op'd, every assertion above would go back to
    // matching comments and this whole describe would quietly stop proving anything.
    expect(css).toContain(".my-chip--outline"); // present in a comment AND as a rule
    expect(hasClassSelector(cssCode, "my-chip--outline")).toBe(true);
    const commentOnly = "my-chip--this-selector-exists-only-in-this-test";
    expect(hasClassSelector(`/* .${commentOnly} */`, commentOnly)).toBe(true); // raw: matches
    expect(hasClassSelector(stripComments(`/* .${commentOnly} */`), commentOnly)).toBe(false);
  });

  test("buttonClass — all 6 variants × representative states", () => {
    const variants: BtnVariant[] = ["pri", "acc", "sec", "gho", "dan", "tone"];
    const states = [
      {},
      { small: true },
      { disabled: true },
      { loading: true },
      { block: true },
      { small: true, disabled: true },
    ];
    for (const variant of variants) {
      for (const state of states) {
        expectSelectorsFor(buttonClass(variant, state));
      }
    }
  });

  test("chipClass — every tone × every size, enumerated from the exported vocabulary", () => {
    // Enumerated rather than restated: the v2 card grew the atom two tones and a size axis, and a
    // hard-coded list here would have kept passing while the new modifiers had no rules at all.
    // (test/css-chip.test.ts owns the family's detailed coverage; this is the sheet-wide sweep.)
    for (const tone of CHIP_TONES) {
      expectSelectorsFor(chipClass(tone));
      for (const size of CHIP_SIZES) expectSelectorsFor(chipClass(tone, { size }));
    }
  });

  test("statusLineClass — all 6 tones", () => {
    const tones: StatusTone[] = ["ok", "warn", "error", "info", "muted", "accent"];
    for (const tone of tones) expectSelectorsFor(statusLineClass(tone));
  });

  test("bannerClass — all 6 tones", () => {
    const tones: BannerTone[] = ["warn", "info", "ok", "error", "accent", "neutral"];
    for (const tone of tones) expectSelectorsFor(bannerClass(tone));
  });

  test("gaugeTone — .my-gauge__fill--{ok,warn,error} for every tone it can return", () => {
    const pctSamples = [0, 50, 74, 75, 89, 90, 100];
    const tones = new Set(pctSamples.map((pct) => gaugeTone(pct)));
    expect(tones).toEqual(new Set(["ok", "warn", "error"]));
    for (const tone of tones) {
      // `cssCode`, not `css`: same reason as expectSelectorsFor above — a prose mention is not
      // a rule, and this is the one other call site in check (e) that resolves a selector.
      const cls = `my-gauge__fill--${tone}`;
      expect({ cls, found: hasClassSelector(cssCode, cls) }).toEqual({ cls, found: true });
    }
  });

  test("check (e) resolves selectors ONLY against the stripped sheet", () => {
    // Belt for the fix: the raw sheet must never be handed to hasClassSelector anywhere inside
    // this describe. Asserted on the source text, because a future call site added with `css`
    // would otherwise reintroduce the comment-satisfies-coverage hole silently.
    const self = readFileSync(join(import.meta.dir, "css.test.ts"), "utf8");
    const checkE = self.slice(self.indexOf('describe("styles.css — (e)'));
    expect(checkE.length).toBeGreaterThan(500);
    expect(checkE).not.toMatch(/hasClassSelector\(\s*css\s*,/);
  });
});
