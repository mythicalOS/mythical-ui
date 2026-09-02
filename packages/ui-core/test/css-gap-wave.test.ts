// test/css-gap-wave.test.ts — stylesheet coverage for the tone-outlined
// button, the chip-flag info arm, the stepper, the tab segments, the popover rich rows, the
// callout family + its "?" opener, and the pulse rider. Sibling of test/css.test.ts's check (e)
// and of test/css-small-atoms.test.ts: every class string the new logic EMITS must have a real
// selector in styles.css, and every element class the bindings render must exist too — a
// component whose classes have no rules ships invisible.
//
// The tone-line block's own contract lives in test/css-button-tone-line.test.ts.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  CALLOUT_PARTS,
  CALLOUT_TONES,
  CHIP_FLAG_TONES,
  POPOVER_CLASS,
  SEG_PARTS,
  STEPPER_PARTS,
  STEP_STATES,
  buttonClass,
  calloutClass,
  chipFlagClass,
  helpClass,
  popItemClass,
  segClass,
  segOptionClass,
  stepClass,
  stepperClass,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

/** The canonical tokens live in the SIBLING mythical-design repo; walk up rather than hard-coding
 *  the hop count (the css-small-atoms precedent — a worktree checkout changes the depth). */
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A real, standalone selector occurrence — `.my-seg` must not be satisfied by `.my-seg__opt`. */
function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(stripComments(css));
}

function expectSelectorsFor(classString: string) {
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    expect({ token, found: hasClassSelector(token) }).toEqual({ token, found: true });
  }
}

describe("tone-outlined button — the sweep (contract in css-button-tone-line.test.ts)", () => {
  test("buttonClass('tone-line') output — representative states — has selectors", () => {
    for (const state of [{}, { small: true }, { disabled: true }, { small: true, loading: true }]) {
      expectSelectorsFor(buttonClass("tone-line", state));
    }
  });
});

describe("chip-flag info arm", () => {
  test("chipFlagClass output — every tone, enumerated from the exported vocabulary — has selectors", () => {
    for (const tone of CHIP_FLAG_TONES) expectSelectorsFor(chipFlagClass(tone));
  });

  test("the info arm is the info soft pair, selector-bound", () => {
    const rule = css.match(/\.my-chip-flag--info\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("background: var(--my-info-soft)");
    expect(rule?.[1]).toContain("color: var(--my-info)");
  });
});

describe("stepper", () => {
  test("stepperClass / stepClass output — every size × state — has selectors", () => {
    expectSelectorsFor(stepperClass());
    expectSelectorsFor(stepperClass("sm"));
    for (const state of STEP_STATES) expectSelectorsFor(stepClass(state));
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(STEPPER_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("a clickable step carries the shared focus ring (rule 6) on the button form only", () => {
    const ring = stripComments(css).match(/button\.my-stepper__step:focus-visible\s*\{([^}]*)\}/);
    expect(ring).not.toBeNull();
    expect(ring?.[1]).toContain("outline: 2px solid var(--my-accent)");
    expect(ring?.[1]).toContain("outline-offset: 2px");
  });

  test("the dot's rest border is transparent, so state changes cannot reflow (chip-v2 grammar)", () => {
    const dot = css.match(/\.my-stepper__dot\s*\{([^}]*)\}/);
    expect(dot).not.toBeNull();
    expect(dot?.[1]).toMatch(/border:\s*1\.5px solid transparent/);
    const done = css.match(/\.my-stepper__step--done\s+\.my-stepper__dot\s*\{([^}]*)\}/);
    expect(done?.[1]).toContain("border-color: var(--my-accent)");
  });

  test("done is the ACCENT family, never an ok recipe (token rule 2: progress is not a status)", () => {
    const bare = stripComments(css);
    const doneRules = [...bare.matchAll(/\.my-stepper__step--done[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(doneRules.length).toBeGreaterThan(0);
    for (const r of doneRules) expect(r).not.toMatch(/--my-ok/);
    expect(doneRules.some((r) => r.includes("var(--my-accent-soft)"))).toBe(true);
  });
});

describe("tab segments", () => {
  test("segClass / segOptionClass output — every state — has selectors", () => {
    expectSelectorsFor(segClass());
    expectSelectorsFor(segClass({ grow: true }));
    expectSelectorsFor(segOptionClass());
    expectSelectorsFor(segOptionClass({ selected: true }));
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(SEG_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("selection is the house grammar: accent-soft fill + accent-strong ink + bold, never a full accent fill", () => {
    const on = css.match(/\.my-seg__opt\.is-on\s*\{([^}]*)\}/);
    expect(on).not.toBeNull();
    expect(on?.[1]).toContain("background: var(--my-accent-soft)");
    expect(on?.[1]).toContain("color: var(--my-accent-strong)");
    expect(on?.[1]).toContain("font-weight: var(--my-fw-bold)");
    expect(on?.[1]).not.toMatch(/background:\s*var\(--my-accent\)\s*;/);
  });

  test("options are squared --my-r-control (rule 10 — not the theme-toggle pill)", () => {
    // Line-anchored: the `--grow` block's descendant rule mentions the option first.
    const opt = css.match(/\n\.my-seg__opt\s*\{([^}]*)\}/);
    expect(opt).not.toBeNull();
    expect(opt?.[1]).toContain("border-radius: var(--my-r-control)");
    expect(opt?.[1]).not.toContain("--my-r-pill");
  });

  test("rule 6 — the option carries the shared focus ring; rule 5 — the count is tabular", () => {
    const ring = stripComments(css).match(/\.my-seg__opt:focus-visible\s*\{([^}]*)\}/);
    expect(ring?.[1]).toContain("outline: 2px solid var(--my-accent)");
    const count = css.match(/\.my-seg__count\s*\{([^}]*)\}/);
    expect(count?.[1]).toContain("font-variant-numeric: tabular-nums");
    expect(count?.[1]).not.toMatch(/opacity/); // normalization: muted ink, never opacity dimming
  });
});

describe("popover rich rows", () => {
  test("popItemClass output — every state combination — has selectors", () => {
    for (const s of [
      {},
      { rich: true },
      { selected: true },
      { dim: true },
      { rich: true, selected: true, dim: true },
    ]) {
      expectSelectorsFor(popItemClass(s));
    }
  });

  test("EVERY new part has a selector — enumerated from the one class map", () => {
    for (const key of ["itemRich", "avatar", "body", "name", "sub", "lead", "group"] as const) {
      const c = POPOVER_CLASS[key];
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("the selected row's avatar flips to the accent fill with --my-surface ink (never a hex white)", () => {
    const rule = css.match(/\.my-pop__item\.is-selected\s+\.my-pop__av\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("background: var(--my-accent)");
    expect(rule?.[1]).toContain("color: var(--my-surface)");
  });

  test("dimming is the disabled ink (token rule 8), and the dim name is not the disabled name", () => {
    const dim = css.match(/\.my-pop__item\.is-dim\s*\{([^}]*)\}/);
    expect(dim).not.toBeNull();
    expect(dim?.[1]).toContain("color: var(--my-disabled-ink)");
    expect(dim?.[1]).not.toMatch(/opacity/);
  });

  test("the group header is mono-uppercase with a rule line — a distinct job from __head", () => {
    const group = css.match(/\.my-pop__group\s*\{([^}]*)\}/);
    expect(group).not.toBeNull();
    expect(group?.[1]).toContain("font-family: var(--my-font-mono)");
    expect(group?.[1]).toContain("text-transform: uppercase");
    expect(stripComments(css)).toMatch(/\.my-pop__group::after/);
  });
});

describe("callout family + the ? opener", () => {
  test("calloutClass output — every tone, enumerated from the exported vocabulary — has selectors", () => {
    for (const tone of CALLOUT_TONES) expectSelectorsFor(calloutClass(tone));
  });

  test("helpClass output — both states — has selectors", () => {
    expectSelectorsFor(helpClass());
    expectSelectorsFor(helpClass({ open: true }));
  });

  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(CALLOUT_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("both title dresses carry the tone ink, per tone, selector-bound", () => {
    const bare = stripComments(css);
    for (const [tone, ink] of [
      ["ok", "--my-ok"],
      ["warn", "--my-warn"],
      ["info", "--my-info"],
      ["error", "--my-error"],
      ["neutral", "--my-muted"],
    ] as const) {
      const re = new RegExp(
        `\\.my-callout--${tone}\\s+\\.my-callout__title,\\s*` +
          `\\.my-callout--${tone}\\s+\\.my-callout__kicker\\s*\\{\\s*color:\\s*var\\(${escapeRegex(ink)}\\);\\s*\\}`,
      );
      expect({ tone, bound: re.test(bare) }).toEqual({ tone, bound: true });
    }
    // the accent default rides -strong, never bare accent (token rule 1)
    const title = css.match(/\.my-callout__title\s*\{([^}]*)\}/);
    expect(title?.[1]).toContain("color: var(--my-accent-strong)");
  });

  test("the opener is round BY RULING-PENDING EXCEPTION, and announces itself from the binding", () => {
    // The circle is what every page site draws; the block's comment records it as a proposed
    // rule-10 scoped exception not yet adopted by the design book. Pinned so a change is a
    // decision, not drift.
    const help = css.match(/\.my-help\s*\{([^}]*)\}/);
    expect(help).not.toBeNull();
    expect(help?.[1]).toContain("border-radius: 50%");
    const open = css.match(/\.my-help\.is-open\s*\{([^}]*)\}/);
    expect(open?.[1]).toContain("background: var(--my-accent-soft)");
    const ring = stripComments(css).match(/\.my-help:focus-visible\s*\{([^}]*)\}/);
    expect(ring?.[1]).toContain("outline: 2px solid var(--my-accent)");
  });
});

describe("the pulse rider", () => {
  test("the class, its 1s period and its keyframes ship", () => {
    expect(hasClassSelector("my-pulse")).toBe(true);
    expect(css).toMatch(/\.my-pulse\s*\{\s*animation:\s*my-pulse 1s ease-in-out infinite;\s*\}/);
    expect(css).toMatch(/@keyframes my-pulse\s*\{\s*50%\s*\{\s*opacity:\s*\.4;\s*\}\s*\}/);
  });

  test("the reduced-motion guard is present — non-negotiable", () => {
    const reduced = css.match(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.my-pulse\s*\{\s*animation:\s*none;\s*\}\s*\}/,
    );
    expect(reduced).not.toBeNull();
  });
});

describe("the new blocks obey the sheet's standing rules", () => {
  const marker = "STEPPER · SEG · CALLOUT/HELP · PULSE";
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
});
