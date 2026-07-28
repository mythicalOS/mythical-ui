// test/css-tags.test.ts — stylesheet coverage for the tags & chips family (Tag · Flag ·
// ChipDropdown). Sibling of test/css.test.ts's check (e) and test/css-small-atoms.test.ts: every
// class string the new logic EMITS must have a real selector in styles.css, and every element
// class the bindings render must exist too — a component whose classes have no rules ships
// invisible.
//
// It is a separate file (rather than more cases in css.test.ts) for the reason
// css-small-atoms.test.ts already gives: this branch adds no contended edits to a file other
// in-flight work also touches. It also lets the token check use the walk-up resolver below, which
// css.test.ts's fixed `../../../../` cannot do.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CHIP_DROPDOWN_PARTS,
  FLAG_TONES,
  TAG_PARTS,
  TAG_SIZES,
  TAG_TONES,
  chipDropdownClass,
  flagClass,
  tagClass,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

/** The canonical tokens live in the SIBLING mythical-design repo. Its location relative to this
 *  package differs between a normal checkout and a git worktree, so walk up until it is found
 *  instead of hard-coding a fixed number of `..` hops (verbatim from css-small-atoms.test.ts —
 *  same problem, same fix). */
function findTokensCss(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "mythical-design", "tokens.css");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("canonical mythical-design/tokens.css not found above " + import.meta.dir);
}

const tokensCss = readFileSync(findTokensCss(), "utf8");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Selector lookups run against the COMMENT-STRIPPED sheet. This block documents its own class
 *  names in prose ("`.my-tag` pill + soft fill …"), and a prose mention is not a rule — matching
 *  it would let a component whose selector was deleted still pass its coverage check. */
const cssCode = stripComments(css);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A real, standalone selector occurrence — `.my-tag` must not be satisfied by `.my-tag--ok`, and
 *  `.my-flag` must not be satisfied by `.my-flag--warn`. */
function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(cssCode);
}

function expectSelectorsFor(classString: string) {
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    expect({ token, found: hasClassSelector(token) }).toEqual({ token, found: true });
  }
}

/** Body of the first rule whose selector list starts with exactly this selector. */
function ruleBody(selector: string): string | null {
  const re = new RegExp(`(?:^|\\})\\s*${escapeRegex(selector)}(?![\\w-])[^{}]*\\{([^}]*)\\}`, "m");
  return cssCode.match(re)?.[1] ?? null;
}

describe("tag", () => {
  test("tagClass output — every tone × every size (and the default step) — has selectors", () => {
    for (const tone of TAG_TONES) {
      expectSelectorsFor(tagClass(tone));
      for (const size of TAG_SIZES) expectSelectorsFor(tagClass(tone, { size }));
    }
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(TAG_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("the tag is the PILL (rule 10) and carries no pointer affordance of its own", () => {
    const root = ruleBody(".my-tag");
    expect(root).not.toBeNull();
    expect(root).toContain("border-radius: var(--my-r-pill)");
    // A non-interactive label must never get a click cursor. The × child may, and does.
    expect(root).not.toContain("cursor");
    expect(cssCode).not.toMatch(/\.my-tag:hover/);
  });

  test("the removable × is the one focusable child, with its own focus ring (rule 6)", () => {
    const x = ruleBody(".my-tag__x");
    expect(x).not.toBeNull();
    expect(x).toContain("cursor: pointer");
    expect(cssCode).toMatch(/\.my-tag__x:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--my-accent\)/);
    // …and the tag itself never gets one, because it is never focusable.
    expect(cssCode).not.toMatch(/\.my-tag:focus/);
  });

  test("the × meets the card's ≥24px removal target, via an overlay that does not paint", () => {
    // The glyph's own box is ~12×11px; a roomier tag grows the TAG, not the button. Without the
    // overlay the atom would document a target it does not deliver. Pinned so it cannot be
    // dropped as "dead CSS".
    expect(ruleBody(".my-tag__x")).toContain("position: relative");
    const after = ruleBody(".my-tag__x::after");
    expect(after).not.toBeNull();
    expect(after).toContain('content: ""');
    expect(after).toContain("position: absolute");
    expect(after).toContain("width: 24px");
    expect(after).toContain("height: 24px");
    expect(after).toContain("transform: translate(-50%, -50%)");
    // It must stay invisible — a painted overlay would cover the glyph it exists to enlarge.
    expect(after).not.toContain("background");
    expect(after).not.toContain("border");
  });

  test("the count is tabular (token rule #5: tabular-nums on all counters)", () => {
    const num = ruleBody(".my-tag__num");
    expect(num).not.toBeNull();
    expect(num).toContain("font-family: var(--my-font-mono)");
    expect(num).toContain("font-variant-numeric: tabular-nums");
  });

  test("DOCUMENTED normalization: xs is a tighter tag, not a smaller face", () => {
    // The card's `.xs` is 10px and its default is 11px; the canonical --my-fs-* scale has no 10px
    // step, and this sheet's standing rule is to snap odd sizes onto the nearest token (.my-chip
    // and .my-gitchip__flag both did exactly this with the same 10px). So the xs step is carried
    // by padding + gap. Pinned here so the loss is a recorded decision, not a silent drift — and
    // so that minting a 10px token in the sibling repo makes this test the place to revisit.
    expect(ruleBody(".my-tag")).toContain("font-size: var(--my-fs-micro)");
    const xs = ruleBody(".my-tag--xs");
    expect(xs).not.toBeNull();
    expect(xs).not.toContain("font-size");
    expect(xs).toContain("padding: 2px 8px");
    // `md` DOES step up, because 12.5px has a nearest token that differs from micro.
    expect(ruleBody(".my-tag--md")).toContain("font-size: var(--my-fs-caption)");
  });

  test("--outline uses --my-border, which rule 11 reserves for NON-interactive outlines", () => {
    expect(ruleBody(".my-tag--outline")).toContain("border-color: var(--my-border)");
  });
});

describe("flag", () => {
  test("flagClass output — every tone — has selectors", () => {
    for (const tone of FLAG_TONES) expectSelectorsFor(flagClass(tone));
  });

  test("the flag is squared and mono — the machine-fact shape, not the pill", () => {
    const root = ruleBody(".my-flag");
    expect(root).not.toBeNull();
    expect(root).toContain("font-family: var(--my-font-mono)");
    expect(root).toContain("border-radius: 4px");
    expect(root).not.toContain("--my-r-pill");
  });

  test("the flag weight rides the nearest --my-fw-* token, never the card's raw 700", () => {
    const root = ruleBody(".my-flag");
    expect(root).toContain("font-weight: var(--my-fw-bold)");
    expect(root).not.toMatch(/font-weight:\s*\d/);
  });

  test("no text-transform — forcing case would rewrite a case-sensitive machine fact", () => {
    expect(ruleBody(".my-flag")).not.toContain("text-transform");
  });
});

describe("chip dropdown", () => {
  test("chipDropdownClass output — both states — has selectors", () => {
    expectSelectorsFor(chipDropdownClass());
    expectSelectorsFor(chipDropdownClass({ selected: true }));
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(CHIP_DROPDOWN_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("the ONE interactive member is squared + control-bordered + hoverable (rules 10, 11)", () => {
    const root = ruleBody(".my-chipdd");
    expect(root).not.toBeNull();
    expect(root).toContain("border-radius: var(--my-r-control)");
    expect(root).toContain("border: 1px solid var(--my-control-border)");
    expect(root).toContain("cursor: pointer");
    expect(root).not.toContain("--my-r-pill");
    expect(cssCode).toMatch(/\.my-chipdd:hover[^{]*\{[^}]*background:\s*var\(--my-surface-hover\)/);
    expect(cssCode).toMatch(/\.my-chipdd:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--my-accent\)/);
  });

  test("the hover invite skips the selected chip, so .sel keeps its fill under the pointer", () => {
    const hover = cssCode.match(/\.my-chipdd:hover[^{]*\{/)?.[0] ?? "";
    expect(hover).toContain(":not(.my-chipdd--sel)");
  });

  test("BOTH disabled spellings are painted — the card's aria-disabled and a native :disabled", () => {
    expect(cssCode).toContain('.my-chipdd[aria-disabled="true"]');
    expect(cssCode).toContain(".my-chipdd:disabled");
    const disabled = cssCode.match(/\.my-chipdd:disabled,\s*\.my-chipdd\[aria-disabled="true"\]\s*\{([^}]*)\}/);
    expect(disabled).not.toBeNull();
    // Token rule #8: disabled is the disabled tokens + not-allowed, NEVER opacity on text.
    expect(disabled?.[1]).toContain("background: var(--my-disabled-bg)");
    expect(disabled?.[1]).toContain("color: var(--my-disabled-ink)");
    expect(disabled?.[1]).toContain("cursor: not-allowed");
    expect(disabled?.[1]).not.toContain("opacity");
  });

  test("the hover invite is withheld from BOTH disabled spellings", () => {
    const hover = cssCode.match(/\.my-chipdd:hover[^{]*\{/)?.[0] ?? "";
    expect(hover).toContain(":not(:disabled)");
    expect(hover).toContain(':not([aria-disabled="true"])');
  });
});

describe("the new block obeys the sheet's standing rules", () => {
  const marker = "TAGS & CHIPS";
  const block = css.slice(css.indexOf(marker));

  test("the block is found and non-trivial (the scan is meaningful)", () => {
    expect(css.indexOf(marker)).toBeGreaterThan(-1);
    expect(block.length).toBeGreaterThan(1000);
  });

  test("zero hard-coded hex colors outside comments", () => {
    expect(stripComments(block).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  test("zero raw px font-size values — every one resolves through a --my-fs-* token", () => {
    expect(block.match(/font-size:\s*[\d.]+px/g) ?? []).toEqual([]);
  });

  test("every --my-* token referenced in the block exists in the canonical tokens.css", () => {
    const defined = new Set(
      Array.from(stripComments(tokensCss).matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]),
    );
    const referenced = new Set(
      Array.from(block.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]),
    );
    expect(referenced.size).toBeGreaterThan(5);
    expect(Array.from(referenced).filter((t) => !defined.has(t)).sort()).toEqual([]);
  });

  test("the family is ADDITIVE — the existing chip atom is untouched by it", () => {
    // The Tag/Chip supersession question is a future maintainer decision; nothing here may
    // pre-empt it by re-pointing or overriding the older atom's rules. Comments are stripped
    // first: this block names `.my-chip` in prose (as the precedent it follows), and prose is
    // not a rule.
    // `block` starts INSIDE the header comment (the marker lives in it), so the remainder of that
    // comment has to go before the balanced ones can be stripped.
    const code = stripComments(block.slice(block.indexOf("*/") + 2));
    expect(code.length).toBeGreaterThan(1000); // the strip did not eat the rules
    expect(code).not.toMatch(/\.my-chip(?![\w-])/);
    expect(code).not.toMatch(/\.my-chip--/);
  });
});
