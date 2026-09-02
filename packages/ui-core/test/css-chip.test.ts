// test/css-chip.test.ts — stylesheet coverage for the chip family (Chip · ChipFlag ·
// ChipDropdown). Sibling of test/css.test.ts's check (e) and test/css-small-atoms.test.ts: every
// class string the family's logic EMITS must have a real selector in styles.css, and every element
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
  CHIP_FLAG_TONES,
  CHIP_PARTS,
  CHIP_SIZES,
  CHIP_TONES,
  chipClass,
  chipDropdownClass,
  chipFlagClass,
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
 *  names in prose ("`.my-chip` pill + soft fill …"), and a prose mention is not a rule — matching
 *  it would let a component whose selector was deleted still pass its coverage check. */
const cssCode = stripComments(css);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A real, standalone selector occurrence — `.my-chip` must not be satisfied by `.my-chip--ok`,
 *  `.my-chip__dot`, `.my-chip-flag` or `.my-chip-dd`. */
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

describe("chip", () => {
  test("chipClass output — every tone × every size (and the default step) — has selectors", () => {
    for (const tone of CHIP_TONES) {
      expectSelectorsFor(chipClass(tone));
      for (const size of CHIP_SIZES) expectSelectorsFor(chipClass(tone, { size }));
    }
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(CHIP_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("the chip is the PILL (rule 10) and carries no pointer affordance of its own", () => {
    const root = ruleBody(".my-chip");
    expect(root).not.toBeNull();
    expect(root).toContain("border-radius: var(--my-r-pill)");
    // A non-interactive label must never get a click cursor. The × child may, and does.
    expect(root).not.toContain("cursor");
    expect(cssCode).not.toMatch(/\.my-chip:hover/);
    expect(cssCode).not.toMatch(/\.my-chip:focus/);
  });

  test("v2 base metrics: the card's box, and NO letter-spacing", () => {
    // The card's base is `padding:3px 11px; gap:6px; border:1px solid transparent`, with no
    // letter-spacing at all. The pre-v2 atom said 2px 9px / gap 5 / letter-spacing .3px; this is
    // the deliberate visual change the fold makes to every existing consumer, so it is pinned.
    const root = ruleBody(".my-chip");
    expect(root).toContain("padding: 3px 11px");
    expect(root).toContain("gap: 6px");
    expect(root).toContain("border: 1px solid transparent");
    expect(root).not.toContain("letter-spacing");
  });

  test("the neutral default is the quiet resting fill, not the disabled one", () => {
    // A chip at rest reads as furniture; --my-disabled-bg would make it read as a dead control.
    const root = ruleBody(".my-chip");
    expect(root).toContain("background: var(--my-surface-hover)");
    expect(root).toContain("color: var(--my-muted)");
  });

  test("the removable × is the one focusable child, with its own focus ring (rule 6)", () => {
    const x = ruleBody(".my-chip__x");
    expect(x).not.toBeNull();
    expect(x).toContain("cursor: pointer");
    expect(cssCode).toMatch(
      /\.my-chip__x:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--my-accent\)/,
    );
  });

  test("the × meets the card's ≥24px removal target, via an overlay that does not paint", () => {
    // The glyph's own box is ~12×11px; a roomier chip grows the CHIP, not the button. Without the
    // overlay the atom would document a target it does not deliver. Pinned so it cannot be
    // dropped as "dead CSS".
    expect(ruleBody(".my-chip__x")).toContain("position: relative");
    const after = ruleBody(".my-chip__x::after");
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

  test("the count is tabular and NEVER dimmed (token rule #5; contrast ruling)", () => {
    const num = ruleBody(".my-chip__num");
    expect(num).not.toBeNull();
    expect(num).toContain("font-family: var(--my-font-mono)");
    expect(num).toContain("font-variant-numeric: tabular-nums");
    // The ok/warn soft pairs sit near AA undimmed, so any opacity puts small mono digits below it
    // on exactly the tones that carry counts most. The mono face is the hierarchy.
    expect(num).not.toContain("opacity");
  });

  test("xs is a genuinely smaller face: --my-fs-nano carries the card's 10px", () => {
    expect(ruleBody(".my-chip")).toContain("font-size: var(--my-fs-micro)");
    const xs = ruleBody(".my-chip--xs");
    expect(xs).not.toBeNull();
    expect(xs).toContain("font-size: var(--my-fs-nano)");
    expect(xs).toContain("padding: 2px 8px");
    // `md` steps up, because 12.5px has a nearest token that differs from micro.
    const md = ruleBody(".my-chip--md");
    expect(md).toContain("font-size: var(--my-fs-caption)");
    expect(md).toContain("padding: 5px 13px");
    expect(md).toContain("font-weight: var(--my-fw-medium)");
  });

  test("--outline uses --my-border, which rule 11 reserves for NON-interactive outlines", () => {
    expect(ruleBody(".my-chip--outline")).toContain("border-color: var(--my-border)");
  });

  test("--empty is the dashed placeholder the card draws", () => {
    expect(ruleBody(".my-chip--empty")).toContain("border: 1px dashed var(--my-control-border)");
  });

  test("the retired `.my-tag` / `.my-flag` selectors are GONE, not merely unreferenced", () => {
    // v2 folds the family into Chip. A surviving rule would be dead weight in every consumer's
    // bundle and would invite a caller back onto a name nothing derives any more.
    expect(cssCode).not.toMatch(/\.my-tag(?![\w-])/);
    expect(cssCode).not.toMatch(/\.my-tag--/);
    expect(cssCode).not.toMatch(/\.my-flag(?![\w-])/);
    expect(cssCode).not.toMatch(/\.my-chipdd(?![\w-])/);
  });
});

describe("chip-flag", () => {
  test("chipFlagClass output — every tone — has selectors", () => {
    for (const tone of CHIP_FLAG_TONES) expectSelectorsFor(chipFlagClass(tone));
  });

  test("the flag is squared and mono — the machine-fact shape, not the pill", () => {
    const root = ruleBody(".my-chip-flag");
    expect(root).not.toBeNull();
    expect(root).toContain("font-family: var(--my-font-mono)");
    expect(root).toContain("font-size: var(--my-fs-nano)");
    expect(root).toContain("border-radius: 4px");
    expect(root).not.toContain("--my-r-pill");
  });

  test("a flag is a counter, so it is tabular (token rule #5)", () => {
    // "2↓ behind" has to align under "10↓ behind". The card omits this; rule 5 does not.
    expect(ruleBody(".my-chip-flag")).toContain("font-variant-numeric: tabular-nums");
  });

  test("the flag weight rides the nearest --my-fw-* token, never the card's raw 700", () => {
    const root = ruleBody(".my-chip-flag");
    expect(root).toContain("font-weight: var(--my-fw-bold)");
    expect(root).not.toMatch(/font-weight:\s*\d/);
  });

  test("no text-transform — forcing case would rewrite a case-sensitive machine fact", () => {
    expect(ruleBody(".my-chip-flag")).not.toContain("text-transform");
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
    const root = ruleBody(".my-chip-dd");
    expect(root).not.toBeNull();
    expect(root).toContain("border-radius: var(--my-r-control)");
    expect(root).toContain("border: 1px solid var(--my-control-border)");
    expect(root).toContain("cursor: pointer");
    expect(root).not.toContain("--my-r-pill");
    expect(cssCode).toMatch(/\.my-chip-dd:hover[^{]*\{[^}]*background:\s*var\(--my-surface-hover\)/);
    expect(cssCode).toMatch(
      /\.my-chip-dd:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--my-accent\)/,
    );
  });

  test("the caret rides the card v2 nano face", () => {
    expect(ruleBody(".my-chip-dd__caret")).toContain("font-size: var(--my-fs-nano)");
  });

  test("the hover invite skips the selected chip, so .sel keeps its fill under the pointer", () => {
    const hover = cssCode.match(/\.my-chip-dd:hover[^{]*\{/)?.[0] ?? "";
    expect(hover).toContain(":not(.my-chip-dd--sel)");
  });

  test("BOTH disabled spellings are painted — the card's aria-disabled and a native :disabled", () => {
    expect(cssCode).toContain('.my-chip-dd[aria-disabled="true"]');
    expect(cssCode).toContain(".my-chip-dd:disabled");
    const disabled = cssCode.match(
      /\.my-chip-dd:disabled,\s*\.my-chip-dd\[aria-disabled="true"\]\s*\{([^}]*)\}/,
    );
    expect(disabled).not.toBeNull();
    // Token rule #8: disabled is the disabled tokens + not-allowed, NEVER opacity on text.
    expect(disabled?.[1]).toContain("background: var(--my-disabled-bg)");
    expect(disabled?.[1]).toContain("color: var(--my-disabled-ink)");
    expect(disabled?.[1]).toContain("cursor: not-allowed");
    expect(disabled?.[1]).not.toContain("opacity");
  });

  test("the hover invite is withheld from BOTH disabled spellings", () => {
    const hover = cssCode.match(/\.my-chip-dd:hover[^{]*\{/)?.[0] ?? "";
    expect(hover).toContain(":not(:disabled)");
    expect(hover).toContain(':not([aria-disabled="true"])');
  });
});

describe("the chip-family block obeys the sheet's standing rules", () => {
  // The full banner line, not the bare words: a prose mention of "the CHIP FAMILY block" elsewhere
  // in the sheet would otherwise re-anchor this whole describe on the wrong offset — and it would
  // do so SILENTLY, since a block that starts too early still passes every scan below.
  const marker = "CHIP FAMILY — the design system's Chip card (v2)";
  const block = css.slice(css.indexOf(marker));

  test("the block is found EXACTLY once, and is non-trivial (the scan is meaningful)", () => {
    expect(css.indexOf(marker)).toBeGreaterThan(-1);
    expect(css.indexOf(marker)).toBe(css.lastIndexOf(marker));
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

  test("the block EXTENDS the base rule rather than restating it", () => {
    // `.my-chip`'s base lives in the additions section higher up. A second base rule here would be
    // a silent override whose winner depends only on file order.
    // `block` starts INSIDE the header comment (the marker lives in it), so the remainder of that
    // comment has to go before the balanced ones can be stripped.
    const code = stripComments(block.slice(block.indexOf("*/") + 2));
    expect(code.length).toBeGreaterThan(1000); // the strip did not eat the rules
    expect(code).not.toMatch(/\.my-chip\s*\{/);
  });

  test("the base rule and its five soft tones still live ABOVE this block", () => {
    // The complement of the check above: if the base were deleted rather than merely not restated,
    // every chip in the family would lose its shape and fill. The marker lives in a comment, so
    // the region is sliced from the RAW sheet and stripped afterwards — slicing the already
    // stripped sheet would silently find nothing and pass on the whole file.
    const markerAt = css.indexOf(marker);
    expect(markerAt).toBeGreaterThan(-1);
    const above = stripComments(css.slice(0, markerAt));
    expect(above).toMatch(/\.my-chip\s*\{/);
    for (const tone of ["accent", "ok", "warn", "error", "info"]) {
      expect({ tone, found: above.includes(`.my-chip--${tone}`) }).toEqual({ tone, found: true });
    }
  });
});
