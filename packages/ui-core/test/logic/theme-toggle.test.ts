// test/logic/theme-toggle.test.ts — the pure half of the theme toggle family
// (ds/components-theme-toggle): mode resolution, class derivation, the radiogroup keyboard
// grammar, the copy and the icon geometry. The stylesheet half is test/css-theme-toggle.test.ts;
// the render contracts live in each binding's own theme-toggle test.

import { describe, expect, test } from "bun:test";
import {
  THEME_ICONS,
  THEME_ICON_LABEL,
  THEME_ICON_PARTS,
  THEME_ICON_STROKE,
  THEME_MODES,
  THEME_MODE_ICONS,
  THEME_MODE_LABELS,
  THEME_SWITCH_LABEL,
  THEME_SWITCH_PARTS,
  THEME_TOGGLE_GROUP_LABEL,
  THEME_TOGGLE_PARTS,
  isThemeMode,
  nextThemeMode,
  resolveThemeIsDark,
  themeGlyph,
  themeIconClass,
  themeIconTarget,
  themeLabel,
  themeModeIndex,
  themeSwitchHasReadableText,
  themeToggleClass,
  themeToggleKeyAction,
  themeToggleTabStop,
  type ThemeMode,
} from "../../src/index.ts";

describe("the mode vocabulary", () => {
  test("exactly three modes, in card order, with System FIRST", () => {
    // The order is load-bearing twice over: it is the knob's resting position and it is what the
    // arrow keys walk. System leading is the card's point — it is a real choice, not the absence
    // of one.
    expect(THEME_MODES).toEqual(["system", "light", "dark"]);
  });

  test("themeModeIndex agrees with the array, and is -1 for anything else", () => {
    for (const [i, m] of THEME_MODES.entries()) expect(themeModeIndex(m)).toBe(i);
    for (const junk of ["", "SYSTEM", "auto", "Dark"]) {
      expect(themeModeIndex(junk as ThemeMode)).toBe(-1);
    }
  });

  test("isThemeMode admits only the three, and never a lookalike", () => {
    for (const m of THEME_MODES) expect(isThemeMode(m)).toBe(true);
    for (const junk of [undefined, null, 0, 1, "", "auto", "Dark", "system ", {}, []]) {
      expect({ junk, ok: isThemeMode(junk) }).toEqual({ junk, ok: false });
    }
  });
});

describe("resolveThemeIsDark — the ONE place `system` becomes a real theme", () => {
  test("an explicit mode ignores the system entirely — that IS the choice the user made", () => {
    for (const prefersDark of [true, false]) {
      expect(resolveThemeIsDark("light", prefersDark)).toBe(false);
      expect(resolveThemeIsDark("dark", prefersDark)).toBe(true);
    }
  });

  test("`system` follows the caller's measurement, in both directions", () => {
    expect(resolveThemeIsDark("system", true)).toBe(true);
    expect(resolveThemeIsDark("system", false)).toBe(false);
  });

  test("an unmeasurable system preference renders LIGHT, the token set's documented default", () => {
    // Never a guess at dark: the tokens are light-first, so the default is the one theme that is
    // always defined rather than the one that happens to be fashionable.
    expect(resolveThemeIsDark("system")).toBe(false);
  });

  test("a FACT parameter is ordinary truthiness — a JS consumer's `1` means yes", () => {
    // Deliberately unlike the opt-in state flags below, which use `=== true`. Answering "light"
    // to a caller who said `1` for "yes, dark" would be a wrong answer, not a safe one.
    for (const yes of [1, "true", {}, []]) {
      expect({ yes, dark: resolveThemeIsDark("system", yes as unknown as boolean) }).toEqual({
        yes,
        dark: true,
      });
    }
    for (const no of [0, "", null, undefined]) {
      expect({ no, dark: resolveThemeIsDark("system", no as unknown as boolean) }).toEqual({
        no,
        dark: false,
      });
    }
  });

  test("an unrecognised mode follows the system, the same as `system` itself", () => {
    // A JS consumer can hand this anything. Following the system is the only answer that is not a
    // claim about a choice the user never made.
    expect(resolveThemeIsDark("auto" as ThemeMode, true)).toBe(true);
    expect(resolveThemeIsDark("auto" as ThemeMode, false)).toBe(false);
  });
});

describe("the icon member has two states and is honest about which", () => {
  test("themeIconTarget is always the opposite of what is on screen, and never `system`", () => {
    expect(themeIconTarget(true)).toBe("light");
    expect(themeIconTarget(false)).toBe("dark");
  });

  test("themeGlyph names the theme you are IN — sun on light, moon on dark", () => {
    expect(themeGlyph(true)).toBe("moon");
    expect(themeGlyph(false)).toBe("sun");
  });

  test("the glyph shown and the target are OPPOSITES — the button never labels its own action", () => {
    // Deliberate, and the card says so in as many words. The state is on the glyph; the action is
    // in the accessible name. If these two ever agreed, the button would be claiming to be
    // something it is not.
    for (const isDark of [true, false]) {
      const target = themeIconTarget(isDark);
      const shown = themeGlyph(isDark);
      expect({ isDark, same: shown === (target === "dark" ? "moon" : "sun") }).toEqual({
        isDark,
        same: false,
      });
    }
  });

  test("ONE glyph derivation serves the icon button and the switch knob", () => {
    // Both want "the theme in force", so a second function would only be somewhere for the answer
    // to stop matching. The switch's card panels agree: sun on light, moon on dark.
    expect(themeGlyph(true)).toBe("moon");
    expect(themeGlyph(false)).toBe("sun");
  });

  test("both read their fact parameter as ordinary truthiness", () => {
    expect(themeGlyph(1 as unknown as boolean)).toBe("moon");
    expect(themeIconTarget(1 as unknown as boolean)).toBe("light");
    expect(themeGlyph(0 as unknown as boolean)).toBe("sun");
    expect(themeGlyph(undefined as unknown as boolean)).toBe("sun");
    expect(themeIconTarget("" as unknown as boolean)).toBe("dark");
  });
});

describe("the radiogroup keyboard grammar", () => {
  test("both axes move the selection, per the WAI-ARIA radiogroup pattern", () => {
    expect(themeToggleKeyAction("ArrowRight")).toBe("next");
    expect(themeToggleKeyAction("ArrowDown")).toBe("next");
    expect(themeToggleKeyAction("ArrowLeft")).toBe("prev");
    expect(themeToggleKeyAction("ArrowUp")).toBe("prev");
  });

  test("every other key is NOT this component's — it must not be swallowed", () => {
    // Enter/Space are absent deliberately: the options are real <button>s, so the browser already
    // synthesises a click. Tab, Escape, Home/End and typing belong to the page.
    for (const key of ["Enter", " ", "Tab", "Escape", "Home", "End", "a", "PageDown", ""]) {
      expect({ key, action: themeToggleKeyAction(key) }).toEqual({ key, action: null });
    }
  });

  test("next/prev walk the three modes and WRAP, in both directions", () => {
    expect(nextThemeMode("system", "next")).toBe("light");
    expect(nextThemeMode("light", "next")).toBe("dark");
    expect(nextThemeMode("dark", "next")).toBe("system");
    expect(nextThemeMode("system", "prev")).toBe("dark");
    expect(nextThemeMode("light", "prev")).toBe("system");
    expect(nextThemeMode("dark", "prev")).toBe("light");
  });

  test("three `next`es return to the start, from every mode — the walk is a real cycle", () => {
    for (const start of THEME_MODES) {
      let m: ThemeMode = start;
      for (let i = 0; i < THEME_MODES.length; i++) m = nextThemeMode(m, "next");
      expect(m).toBe(start);
      for (let i = 0; i < THEME_MODES.length; i++) m = nextThemeMode(m, "prev");
      expect(m).toBe(start);
    }
  });

  test("`next` then `prev` is a no-op from every mode", () => {
    for (const m of THEME_MODES) expect(nextThemeMode(nextThemeMode(m, "next"), "prev")).toBe(m);
  });

  test("a null action leaves the mode alone", () => {
    for (const m of THEME_MODES) expect(nextThemeMode(m, null)).toBe(m);
    // …including a mode it does not recognise: `null` means "no key I own", not "reset".
    expect(nextThemeMode("auto" as ThemeMode, null) as string).toBe("auto");
  });

  test("an unrecognised current mode steps to an END, never off index -1", () => {
    // Off -1 the arithmetic would give `system` for next and `dark` for prev — right by accident
    // for one direction only. The explicit answer is first/last.
    expect(nextThemeMode("auto" as ThemeMode, "next")).toBe("system");
    expect(nextThemeMode("auto" as ThemeMode, "prev")).toBe("dark");
  });
});

describe("class derivation — the segmented member", () => {
  test("the parts are the house BEM shape, and are distinct", () => {
    expect(THEME_TOGGLE_PARTS.root).toBe("my-tt-seg");
    expect(THEME_TOGGLE_PARTS.knob).toBe("my-tt-seg__knob");
    expect(THEME_TOGGLE_PARTS.option).toBe("my-tt-seg__opt");
  });

  test("the root carries the selected mode — that is what positions the knob", () => {
    for (const m of THEME_MODES) {
      expect(themeToggleClass(m)).toBe(`my-tt-seg my-tt-seg--sel-${m}`);
    }
  });

  test("the labelled modifier is additive and never replaces the selection modifier", () => {
    for (const m of THEME_MODES) {
      expect(themeToggleClass(m, { labelled: true })).toBe(
        `my-tt-seg my-tt-seg--lab my-tt-seg--sel-${m}`,
      );
      expect(themeToggleClass(m, { labelled: false })).toBe(themeToggleClass(m));
    }
  });

  test("`labelled` is opt-in by IDENTITY — a truthy non-boolean is not the labelled variant", () => {
    expect(themeToggleClass("system", { labelled: 1 as unknown as boolean })).toBe(
      themeToggleClass("system"),
    );
    expect(themeToggleClass("system", {})).toBe(themeToggleClass("system"));
  });

  test("an unrecognised mode selects NOTHING, and paints nothing", () => {
    // Not `--sel-system`: parking the knob under System would paint a selection that every
    // option's `aria-checked="false"` denies, telling a sighted user and a screen-reader user two
    // different things. `--sel-none` hides the knob, so the paint and the ARIA agree.
    for (const junk of ["auto", "", "Dark"]) {
      expect(themeToggleClass(junk as ThemeMode)).toBe("my-tt-seg my-tt-seg--sel-none");
    }
    // and it is a real, defined modifier — never `--sel-<junk>`, which would have no rule at all
    expect(themeToggleClass("auto" as ThemeMode)).not.toContain("auto");
    expect(themeToggleClass("auto" as ThemeMode, { labelled: true })).toBe(
      "my-tt-seg my-tt-seg--lab my-tt-seg--sel-none",
    );
  });

  test("no real mode ever emits the `nothing selected` state", () => {
    for (const m of THEME_MODES) expect(themeToggleClass(m)).not.toContain("--sel-none");
  });

  test("every mode gets its OWN root class — no two selections paint the same", () => {
    const seen = new Set(THEME_MODES.map((m) => themeToggleClass(m)));
    expect(seen.size).toBe(THEME_MODES.length);
  });
});

describe("class derivation — the icon and switch members", () => {
  test("the icon root takes the bordered modifier, and nothing else", () => {
    expect(themeIconClass()).toBe("my-tt-icon");
    expect(themeIconClass({})).toBe("my-tt-icon");
    expect(themeIconClass({ bordered: true })).toBe("my-tt-icon my-tt-icon--bordered");
    expect(themeIconClass({ bordered: false })).toBe("my-tt-icon");
    expect(themeIconClass({ bordered: 1 as unknown as boolean })).toBe("my-tt-icon");
  });

  test("the pressed state is NOT a class — it can only be painted by announcing it", () => {
    // aria-pressed drives the cross-fade in CSS, so a product cannot show the dark glyph without
    // also telling a screen reader the button is pressed.
    for (const cls of [themeIconClass(), themeIconClass({ bordered: true })]) {
      expect(cls).not.toContain("dark");
      expect(cls).not.toContain("pressed");
    }
  });

  test("the icon and switch parts are distinct and complete", () => {
    expect(THEME_ICON_PARTS).toEqual({
      root: "my-tt-icon",
      stack: "my-tt-icon__stack",
      sun: "my-tt-icon__sun",
      moon: "my-tt-icon__moon",
    });
    expect(THEME_SWITCH_PARTS).toEqual({
      root: "my-tt-switch",
      input: "my-tt-switch__input",
      track: "my-tt-switch__track",
      knob: "my-tt-switch__knob",
    });
  });

  test("no part collides with another member's", () => {
    const all = [
      ...Object.values(THEME_TOGGLE_PARTS),
      ...Object.values(THEME_ICON_PARTS),
      ...Object.values(THEME_SWITCH_PARTS),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("copy", () => {
  test("every mode has a visible word — a glyph alone never names a mode", () => {
    for (const m of THEME_MODES) {
      expect(THEME_MODE_LABELS[m].length).toBeGreaterThan(0);
    }
    expect(THEME_MODE_LABELS).toEqual({ system: "System", light: "Light", dark: "Dark" });
  });

  test("the group, icon and switch names are the card's, verbatim", () => {
    expect(THEME_TOGGLE_GROUP_LABEL).toBe("Colour theme");
    expect(THEME_ICON_LABEL).toBe("Toggle theme");
    expect(THEME_SWITCH_LABEL).toBe("Dark mode");
  });
});

describe("icon geometry — one source, drawn by both bindings", () => {
  test("every mode maps to a glyph, and all three glyphs are used", () => {
    expect(THEME_MODE_ICONS).toEqual({ system: "system", light: "sun", dark: "moon" });
    expect(new Set(Object.values(THEME_MODE_ICONS)).size).toBe(3);
  });

  test("the shared stroke set is the card's", () => {
    expect(THEME_ICON_STROKE).toEqual({
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
    });
  });

  test("each glyph is a real, non-empty 24-grid drawing", () => {
    for (const name of ["sun", "moon", "system"] as const) {
      const spec = THEME_ICONS[name];
      expect({ name, viewBox: spec.viewBox }).toEqual({ name, viewBox: "0 0 24 24" });
      expect(spec.shapes.length).toBeGreaterThan(0);
    }
  });

  test("round JOINS only where the card draws them — the sun has none to round", () => {
    expect(THEME_ICONS.sun.roundJoins).toBe(false);
    expect(THEME_ICONS.moon.roundJoins).toBe(true);
    expect(THEME_ICONS.system.roundJoins).toBe(true);
  });

  test("the shapes are exactly the card's paths", () => {
    expect(THEME_ICONS.sun.shapes[0]).toEqual({ kind: "circle", cx: 12, cy: 12, r: 4.2 });
    expect(THEME_ICONS.sun.shapes[1]).toEqual({
      kind: "path",
      d: "M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6",
    });
    expect(THEME_ICONS.moon.shapes).toEqual([
      { kind: "path", d: "M20.5 14.4A8.6 8.6 0 1 1 9.6 3.5a6.9 6.9 0 0 0 10.9 10.9Z" },
    ]);
    expect(THEME_ICONS.system.shapes).toEqual([
      { kind: "rect", x: 2.8, y: 4, width: 18.4, height: 12.4, rx: 2 },
      { kind: "path", d: "M8.6 20.4h6.8M12 16.4v4" },
    ]);
  });

  test("every shape is a kind the bindings can actually render", () => {
    // Both bindings branch on exactly these three. A fourth added here without touching them
    // would render nothing at all, silently.
    const kinds = new Set(
      Object.values(THEME_ICONS).flatMap((s) => s.shapes.map((shape) => shape.kind)),
    );
    expect([...kinds].sort()).toEqual(["circle", "path", "rect"]);
  });
});

describe("themeToggleTabStop — the group stays reachable even with nothing selected", () => {
  test("normally the tab stop IS the selection", () => {
    for (const [i, m] of THEME_MODES.entries()) expect(themeToggleTabStop(m)).toBe(i);
  });

  test("an unrecognised mode puts it on the FIRST option, not on none of them", () => {
    // Deriving the roving tabindex straight from `aria-checked` would leave every option at -1
    // when nothing is checked: the whole control would drop out of the tab order, and a keyboard
    // user could not reach it to fix the very state that broke it.
    for (const junk of ["auto", "", "Dark"]) {
      expect({ junk, stop: themeToggleTabStop(junk as ThemeMode) }).toEqual({ junk, stop: 0 });
    }
  });

  test("it always names a real option", () => {
    for (const m of [...THEME_MODES, "auto" as ThemeMode]) {
      const stop = themeToggleTabStop(m);
      expect(stop).toBeGreaterThanOrEqual(0);
      expect(stop).toBeLessThan(THEME_MODES.length);
    }
  });
});

describe("themeLabel — a name override may never blank a control's name", () => {
  test("a usable override wins", () => {
    expect(themeLabel("Appearance", THEME_SWITCH_LABEL)).toBe("Appearance");
    expect(themeLabel("  Appearance  ", THEME_SWITCH_LABEL)).toBe("  Appearance  ");
  });

  test("an unusable one falls back — an empty name is worse than no override", () => {
    // A control named "" is announced as nothing at all; the default at least says what it is.
    for (const junk of [undefined, null, "", "   ", "\t\n", 0, 1, {}, [], true]) {
      expect({ junk, name: themeLabel(junk, THEME_SWITCH_LABEL) }).toEqual({
        junk,
        name: THEME_SWITCH_LABEL,
      });
    }
  });
});

describe("themeSwitchHasReadableText — deciding whether the input needs its own name", () => {
  test("text this module can READ counts: strings, numbers, and arrays of them", () => {
    expect(themeSwitchHasReadableText("Dark mode")).toBe(true);
    expect(themeSwitchHasReadableText(0)).toBe(true); // a 0 renders as "0"
    expect(themeSwitchHasReadableText(["Dark mode"])).toBe(true);
    expect(themeSwitchHasReadableText([false, null, "Dark ", "mode"])).toBe(true);
    expect(themeSwitchHasReadableText([["Dark"], " mode"])).toBe(true);
  });

  test("nothing-shaped children are nothing — including the ones a conditional produces", () => {
    // `{showLabel && "Dark mode"}` passes `false`, not `undefined`. Reading that as text would
    // leave the checkbox with no accessible name at all.
    for (const empty of [undefined, null, false, true, "", "   ", [], [false, null], [[]], [" ", ""]]) {
      expect({ empty, has: themeSwitchHasReadableText(empty) }).toEqual({ empty, has: false });
    }
    expect(themeSwitchHasReadableText(NaN)).toBe(false);
    expect(themeSwitchHasReadableText(Infinity)).toBe(false);
  });

  test("a framework element is OPAQUE, so it does not count — the control keeps a name", () => {
    // A render-only binding cannot look inside an element to see what, or whether, it renders:
    // `<></>`, a component returning null, and a <span> full of words are indistinguishable here.
    // Counting them as text is what would leave the checkbox nameless (WCAG 4.1.2); not counting
    // them at worst names it redundantly, which is recoverable.
    for (const opaque of [{ type: "span", props: {} }, { type: () => null, props: {} }, () => {}]) {
      expect(themeSwitchHasReadableText(opaque)).toBe(false);
    }
    expect(themeSwitchHasReadableText([{ type: "b", props: {} }])).toBe(false);
  });
});
