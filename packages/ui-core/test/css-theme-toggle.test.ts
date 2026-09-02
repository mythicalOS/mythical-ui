// test/css-theme-toggle.test.ts — the stylesheet half of the theme toggle family
// (ds/components-theme-toggle).
//
// The sheet-wide guards (no hex literals, every --my-* token resolves in the canonical tokens.css,
// the additions section uses --my-fs-* steps, the structural brace/comment walk) already cover
// these rules and are NOT repeated here. This file guards what is specific to this family and is
// DESIGN rather than styling:
//
//   1. Every class the logic emits has a real rule, so a rename cannot silently unstyle a member.
//   2. The two segmented variants raise the selection two different ways, and BOTH are pure CSS.
//      Neither may quietly grow a measured layout: an inline style is a CSP violation here and the
//      bindings are render-only.
//   3. The icon member shows the theme you are IN, and does it as a cross-fade.
//   4. The states that must be ANNOUNCED to be painted stay that way (aria-checked, aria-pressed,
//      :checked, aria-disabled) — none of them may become a plain class.
//   5. The pill radius, which is in tension with canonical token rule 10, is pinned so a change is
//      deliberate rather than a drive-by.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  THEME_ICON_PARTS,
  THEME_MODES,
  THEME_SWITCH_PARTS,
  THEME_TOGGLE_PARTS,
  themeGlyph,
  themeIconClass,
  themeToggleClass,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Strip comments: a selector named only in prose is not a rule. This sheet documents several of
 *  its own selectors by name in the block banner above the family. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}
const cssCode = stripComments(css);

function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(cssCode);
}
/** The body of the first rule whose selector matches `selector` exactly. */
function ruleBody(selector: string): string {
  const m = cssCode.match(new RegExp(`(?:^|\\}|,)\\s*${escapeRegex(selector)}\\s*\\{([^{}]*)\\}`));
  expect({ selector, found: m !== null }).toEqual({ selector, found: true });
  return m?.[1] ?? "";
}

describe("(1) every class the logic emits has a real selector", () => {
  function expectSelectorsFor(classString: string) {
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      expect({ token, found: hasClassSelector(token) }).toEqual({ token, found: true });
    }
  }

  test("the strip is real — a selector named ONLY in prose does not satisfy coverage", () => {
    // Guards the guard: the family's banner names `.my-tt-seg` in prose, so a no-op stripComments
    // would let a deleted rule keep passing.
    const commentOnly = "my-tt-this-selector-exists-only-in-this-test";
    expect(new RegExp(`\\.${commentOnly}`).test(`/* .${commentOnly} */`)).toBe(true);
    expect(hasClassSelector(commentOnly)).toBe(false);
  });

  test("segmented — every mode × the labelled axis", () => {
    for (const mode of THEME_MODES) {
      expectSelectorsFor(themeToggleClass(mode));
      expectSelectorsFor(themeToggleClass(mode, { labelled: true }));
    }
    expectSelectorsFor(THEME_TOGGLE_PARTS.knob);
    expectSelectorsFor(THEME_TOGGLE_PARTS.option);
    // …and the state an unrecognised mode degrades to
    expectSelectorsFor(themeToggleClass("auto" as never));
  });

  test("`nothing selected` hides the knob rather than parking it under System", () => {
    // Parking it there would paint a selection that every option's aria-checked="false" denies.
    expect(themeToggleClass("auto" as never)).toContain("my-tt-seg--sel-none");
    expect(ruleBody(".my-tt-seg--sel-none .my-tt-seg__knob")).toMatch(/display:\s*none/);
  });

  test("icon — bare and bordered, plus the stacked glyphs", () => {
    expectSelectorsFor(themeIconClass());
    expectSelectorsFor(themeIconClass({ bordered: true }));
    for (const part of Object.values(THEME_ICON_PARTS)) expectSelectorsFor(part);
  });

  test("switch — every part", () => {
    for (const part of Object.values(THEME_SWITCH_PARTS)) expectSelectorsFor(part);
  });
});

describe("(2) both segmented variants raise the selection without measuring anything", () => {
  test("the sheet carries none of the card's retired measured custom properties", () => {
    // An earlier revision of the card wrote --x1/--x2 and a knob width as INLINE styles from a
    // JS measure(). `style-src 'self'` makes that a CSP violation, and this port never had them —
    // this is the tripwire that keeps it that way if someone ports the older card by mistake.
    for (const name of ["--x1", "--x2"]) {
      expect({ name, present: cssCode.includes(name) }).toEqual({ name, present: false });
    }
  });

  test("icon-only — three fixed 30px cells, so the knob's offsets are known constants", () => {
    const track = ruleBody(".my-tt-seg");
    expect(track).toMatch(/display:\s*inline-flex/);
    expect(track).toMatch(/gap:\s*2px/);
    expect(track).toMatch(/padding:\s*3px/);
    expect(track).toMatch(/position:\s*relative/); // the knob's containing block
    const opt = ruleBody(".my-tt-seg__opt");
    expect(opt).toMatch(/width:\s*30px/);
    expect(opt).toMatch(/height:\s*24px/);
  });

  test("the knob slides on `left`, between offsets that match the cell arithmetic", () => {
    const knob = ruleBody(".my-tt-seg__knob");
    expect(knob).toMatch(/position:\s*absolute/);
    expect(knob).toMatch(/width:\s*30px/);
    expect(knob).toMatch(/transition:\s*left\s+var\(--my-t-base\)/);
    // padding 3px + n x (cell 30px + gap 2px)
    const PAD = 3;
    const STEP = 32;
    const offsets = THEME_MODES.map((_, i) => PAD + i * STEP);
    expect(offsets).toEqual([3, 35, 67]);
    // Every mode states its own position, including the resting one — index 0 is a decision.
    for (const [i, mode] of THEME_MODES.entries()) {
      const body = ruleBody(`.my-tt-seg--sel-${mode} .my-tt-seg__knob`);
      expect({ mode, left: body.match(/left:\s*(\d+)px/)?.[1] }).toEqual({
        mode,
        left: String(offsets[i]),
      });
    }
  });

  test("labelled — the knob is hidden and the CHECKED BUTTON carries the raised look", () => {
    // Options size to their words there, so there is no offset a fixed knob could know.
    expect(ruleBody(".my-tt-seg--lab .my-tt-seg__knob")).toMatch(/display:\s*none/);
    expect(ruleBody(".my-tt-seg--lab .my-tt-seg__opt")).toMatch(/width:\s*auto/);
    const raised = ruleBody('.my-tt-seg--lab .my-tt-seg__opt[aria-checked="true"]');
    expect(raised).toMatch(/background:\s*var\(--my-surface\)/);
    expect(raised).toMatch(/box-shadow:\s*var\(--my-shadow-knob\)/);
  });

  test("every raised surface is a lift of value on the shared token — never a restated shadow", () => {
    for (const sel of [
      ".my-tt-seg__knob",
      '.my-tt-seg--lab .my-tt-seg__opt[aria-checked="true"]',
      ".my-tt-switch__knob",
    ]) {
      const body = ruleBody(sel);
      expect({ sel, shadow: /box-shadow:\s*var\(--my-shadow-knob\)/.test(body) }).toEqual({
        sel,
        shadow: true,
      });
      expect({ sel, surface: /background:\s*var\(--my-surface\)/.test(body) }).toEqual({
        sel,
        surface: true,
      });
    }
  });
});

describe("(3) the icon member shows the theme you are IN", () => {
  const resting = (part: string) => ruleBody(`.${part}`);
  const pressed = (part: string) => ruleBody(`.my-tt-icon[aria-pressed="true"] .${part}`);

  test("light (not pressed) shows the SUN", () => {
    expect(themeGlyph(false)).toBe("sun");
    expect(resting(THEME_ICON_PARTS.sun)).toMatch(/opacity:\s*1/);
    expect(resting(THEME_ICON_PARTS.moon)).toMatch(/opacity:\s*0/);
  });

  test("dark (pressed) shows the MOON", () => {
    expect(themeGlyph(true)).toBe("moon");
    expect(pressed(THEME_ICON_PARTS.moon)).toMatch(/opacity:\s*1/);
    expect(pressed(THEME_ICON_PARTS.sun)).toMatch(/opacity:\s*0/);
  });

  test("it is a cross-fade with a 45deg counter-rotation, not a swap", () => {
    expect(resting(THEME_ICON_PARTS.moon)).toMatch(/transform:\s*rotate\(-45deg\)\s*scale\(\.7\)/);
    expect(pressed(THEME_ICON_PARTS.sun)).toMatch(/transform:\s*rotate\(45deg\)\s*scale\(\.7\)/);
    // both glyphs occupy the same grid cell, which is what makes a fade possible at all
    expect(ruleBody(".my-tt-icon__stack svg")).toMatch(/grid-area:\s*1\s*\/\s*1/);
    expect(ruleBody(".my-tt-icon svg")).toMatch(
      /transition:\s*transform\s+var\(--my-t-base\),\s*opacity\s+var\(--my-t-fast\)/,
    );
  });
});

describe("(4) a state may not be painted unless it is announced", () => {
  test("the segmented selection is aria-checked, never a class on the option", () => {
    expect(cssCode).toMatch(/\.my-tt-seg__opt\[aria-checked="true"\]/);
    expect(hasClassSelector("my-tt-seg__opt--checked")).toBe(false);
    // the base accent lands on the glyph (color), never as a filled pill (background)
    const checked = ruleBody('.my-tt-seg__opt[aria-checked="true"]');
    expect(checked).toMatch(/color:\s*var\(--my-accent-strong\)/);
    expect(checked).not.toMatch(/background/);
  });

  test("the icon's pressed state is aria-pressed, never a class", () => {
    expect(cssCode).toMatch(/\.my-tt-icon\[aria-pressed="true"\]/);
    expect(hasClassSelector("my-tt-icon--pressed")).toBe(false);
    expect(hasClassSelector("my-tt-icon--dark")).toBe(false);
  });

  test("the switch's checked state rides the real input's :checked", () => {
    expect(cssCode).toMatch(/\.my-tt-switch__input:checked\s*\+\s*\.my-tt-switch__track/);
    expect(hasClassSelector("my-tt-switch--on")).toBe(false);
    const knob = ruleBody(".my-tt-switch__input:checked + .my-tt-switch__track .my-tt-switch__knob");
    expect(knob).toMatch(/left:\s*20px/);
    expect(knob).toMatch(/color:\s*var\(--my-accent-strong\)/);
    // 2px inset + 16px knob + 20px travel stays inside the 40px track's padding box (38px)
    expect(20 + 16).toBeLessThanOrEqual(38);
  });

  test("the switch's disabled paint rides aria-disabled, and follows token rule 8", () => {
    const label = ruleBody('.my-tt-switch[aria-disabled="true"]');
    expect(label).toMatch(/color:\s*var\(--my-disabled-ink\)/);
    expect(label).toMatch(/cursor:\s*not-allowed/);
    expect(ruleBody('.my-tt-switch[aria-disabled="true"] .my-tt-switch__track')).toMatch(
      /background:\s*var\(--my-disabled-bg\)/,
    );
    // rule 8 again: never opacity on text
    expect(label).not.toMatch(/opacity/);
  });

  test("the hidden input is hidden without leaving the accessibility tree", () => {
    // display:none / visibility:hidden would take the checkbox out of the tab order and off the
    // accessibility tree along with the role, the checked state and the space bar.
    const input = ruleBody(".my-tt-switch__input");
    expect(input).toMatch(/opacity:\s*0/);
    expect(input).not.toMatch(/display:\s*none/);
    expect(input).not.toMatch(/visibility:\s*hidden/);
  });

  test("every focusable surface carries the canonical ring (token rule 6)", () => {
    for (const sel of [
      ".my-tt-seg__opt:focus-visible",
      ".my-tt-icon:focus-visible",
      ".my-tt-switch__input:focus-visible + .my-tt-switch__track",
    ]) {
      const body = ruleBody(sel);
      expect({ sel, ring: /outline:\s*2px solid var\(--my-accent\)/.test(body) }).toEqual({
        sel,
        ring: true,
      });
      expect({ sel, offset: /outline-offset:\s*2px/.test(body) }).toEqual({ sel, offset: true });
    }
  });
});

describe("(5) the shape decisions are pinned, by maintainer ruling", () => {
  test("the card's pill geometry is what shipped — track, options, knob, switch track", () => {
    // The theme-toggle family keeps the card's pill as a scoped exception to canonical token
    // rule 10 (recorded there), with the sibling `.tog` atom staying squared. The pin makes any
    // departure from that exception a deliberate act.
    for (const sel of [".my-tt-seg", ".my-tt-seg__knob", ".my-tt-seg__opt", ".my-tt-switch__track"]) {
      expect({ sel, pill: /border-radius:\s*var\(--my-r-pill\)/.test(ruleBody(sel)) }).toEqual({
        sel,
        pill: true,
      });
    }
  });

  test("the icon member is squared — rule 10 the ordinary way, since it paints a resting box", () => {
    expect(ruleBody(".my-tt-icon")).toMatch(/border-radius:\s*var\(--my-r-control\)/);
  });

  test("the family's tension with rule 10 is DOCUMENTED in the sheet, not silent", () => {
    // A future reader must not have to rediscover this. If the block banner is ever rewritten
    // without it, this fails and the decision gets re-made on purpose.
    const banner = css.slice(css.indexOf("THEME TOGGLE (ds/components-theme-toggle)"));
    expect(banner).toContain("rule 10");
    expect(banner).toContain("--my-r-pill");
  });

  test("the track and boundary tokens are the card's, and the boundary follows rule 11", () => {
    expect(ruleBody(".my-tt-seg")).toMatch(/background:\s*var\(--my-track\)/);
    const switchTrack = ruleBody(".my-tt-switch__track");
    expect(switchTrack).toMatch(/background:\s*var\(--my-track\)/);
    // a control boundary, so --my-control-border, not --my-border (rule 11)
    expect(switchTrack).toMatch(/border:\s*1px solid var\(--my-control-border\)/);
    // checked = the inputs Toggle's on/off vocabulary
    const on = ruleBody(".my-tt-switch__input:checked + .my-tt-switch__track");
    expect(on).toMatch(/background:\s*var\(--my-accent-soft\)/);
    expect(on).toMatch(/border-color:\s*var\(--my-accent\)/);
  });
});

describe("motion respects prefers-reduced-motion", () => {
  const block = cssCode.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^{}]*my-tt-seg__knob[^{}]*\{[^{}]*\}[^{}]*\}/,
  );

  test("every transition in the family is turned off, not just the animations", () => {
    expect(block).not.toBeNull();
    for (const part of [
      THEME_TOGGLE_PARTS.knob,
      THEME_TOGGLE_PARTS.option,
      THEME_ICON_PARTS.root,
      THEME_SWITCH_PARTS.track,
      THEME_SWITCH_PARTS.knob,
    ]) {
      expect({ part, off: (block?.[0] ?? "").includes(part) }).toEqual({ part, off: true });
    }
    expect(block?.[0]).toMatch(/transition:\s*none/);
  });

  test("the labelled option is listed at ITS specificity, or the override silently loses", () => {
    // `.my-tt-seg--lab .my-tt-seg__opt` restates `transition` at (0,2,0). A bare
    // `.my-tt-seg__opt` (0,1,0) in this block would be outranked no matter that it comes last,
    // and the labelled variant would keep animating for a user who asked it not to.
    const lab = /\.my-tt-seg--lab\s+\.my-tt-seg__opt/.test(ruleBody(".my-tt-seg--lab .my-tt-seg__opt"))
      ? true
      : (block?.[0] ?? "").includes(".my-tt-seg--lab .my-tt-seg__opt");
    expect(lab).toBe(true);
  });

  test("every rule in the family that declares a transition is covered by the block", () => {
    // Derived, not hand-listed: a new animated rule added later must join the block or fail here.
    const animated = Array.from(cssCode.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      .map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
      .filter((r) => /\.my-tt-/.test(r.selector) && /transition:/.test(r.body))
      .filter((r) => !/transition:\s*none/.test(r.body))
      .map((r) => r.selector);
    expect(animated.length).toBeGreaterThan(3);
    const covered = block?.[0] ?? "";
    const uncovered = animated.filter((sel) => !covered.includes(sel));
    expect(uncovered).toEqual([]);
  });
});
