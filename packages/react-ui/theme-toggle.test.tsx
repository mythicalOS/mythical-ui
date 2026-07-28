// packages/react-ui/theme-toggle.test.tsx — render contracts for the theme toggle family:
// ThemeToggle (segmented), ThemeToggleIcon, ThemeToggleSwitch. React twin of
// packages/preact-ui/theme-toggle.test.tsx, asserting the same contracts against the same core
// functions — every expected class string, glyph path and piece of copy is derived by importing
// from @mythicalos/ui-core, never hard-coded, so the two bindings and the core cannot drift.
//
// The only deltas are the ones the binding itself has: `class` → `className`, and React's SSR
// renderer emits `tabindex`/`aria-*` the same way but does not serialise a bare `data-` prop, so
// the marker is `data-tt-opt=""`.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  THEME_ICONS,
  THEME_ICON_LABEL,
  THEME_ICON_PARTS,
  THEME_MODES,
  THEME_MODE_ICONS,
  THEME_MODE_LABELS,
  THEME_SWITCH_LABEL,
  THEME_SWITCH_PARTS,
  THEME_TOGGLE_GROUP_LABEL,
  THEME_TOGGLE_PARTS,
  nextThemeMode,
  themeGlyph,
  themeIconClass,
  themeIconTarget,
  themeLabel,
  themeToggleClass,
  themeToggleKeyAction,
  themeToggleTabStop,
  type ThemeMode,
} from "@mythicalos/ui-core/logic";
import { ThemeToggle, ThemeToggleIcon, ThemeToggleSwitch } from "./src/index.ts";

const noop = () => {};

/** The rendered option vnodes of a segmented control, without a DOM. */
function segmentOptions(vnode: unknown): { props: Record<string, unknown> }[] {
  const children = (vnode as { props: { children: unknown[] } }).props.children;
  return children[1] as { props: Record<string, unknown> }[];
}

/** A stand-in for the radiogroup element the keydown handler reaches through `currentTarget`,
 *  recording which option was focused and with what options. */
function fakeGroup() {
  const focused: { index: number; preventScroll: unknown }[] = [];
  const buttons = THEME_MODES.map((_, index) => ({
    focus: (opts?: { preventScroll?: boolean }) =>
      void focused.push({ index, preventScroll: opts?.preventScroll }),
  }));
  return { focused, node: { querySelectorAll: () => buttons } };
}

describe("ThemeToggle — the segmented member", () => {
  test("the root class is themeToggleClass(...), verbatim, across the whole matrix", () => {
    for (const mode of THEME_MODES) {
      expect(renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} />)).toContain(
        `class="${themeToggleClass(mode)} "`,
      );
      expect(renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} labelled />)).toContain(
        `class="${themeToggleClass(mode, { labelled: true })} "`,
      );
    }
  });

  test("it is a real radiogroup with a name, holding three real radios", () => {
    const html = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} />);
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain(`aria-label="${THEME_TOGGLE_GROUP_LABEL}"`);
    expect(html.match(/role="radio"/g)?.length).toBe(THEME_MODES.length);
    expect(html.match(/<button/g)?.length).toBe(THEME_MODES.length);
    expect(html).toContain(`<span class="${THEME_TOGGLE_PARTS.knob}" aria-hidden="true">`);
  });

  test("System is FIRST — the card's whole point about it being a real choice", () => {
    const html = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} labelled />);
    const order = THEME_MODES.map((m) => html.indexOf(`>${THEME_MODE_LABELS[m]}<`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order[0]).toBeGreaterThan(-1);
  });

  test("exactly one option is aria-checked, and it is the mode handed in", () => {
    for (const mode of THEME_MODES) {
      const html = renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} labelled />);
      expect(html.match(/aria-checked="true"/g)?.length).toBe(1);
      const checked = html.slice(0, html.indexOf('aria-checked="true"'));
      // the checked button is the one whose word follows it
      const after = html.slice(html.indexOf('aria-checked="true"'));
      expect(after).toContain(THEME_MODE_LABELS[mode]);
      expect(checked.split("<button").length - 1).toBe(THEME_MODES.indexOf(mode) + 1);
    }
  });

  test("an unrecognised mode checks NOTHING rather than checking the wrong option", () => {
    // The knob degrades to the resting position (themeToggleClass's contract) — but no option may
    // claim to be selected when none of them is.
    const html = renderToStaticMarkup(<ThemeToggle mode={"auto" as ThemeMode} onModeChange={noop} />);
    expect(html).not.toContain('aria-checked="true"');
    // …and the PAINT agrees: the class is the `nothing selected` state, whose rule hides the knob,
    // not `--sel-system`, which would show System raised while the ARIA denied it.
    expect(html).toContain(`class="${themeToggleClass("auto" as ThemeMode)} "`);
    expect(html).toContain("my-tt-seg--sel-none");
    expect(html).not.toContain("my-tt-seg--sel-system");
  });

  test("…and stays REACHABLE: the first option keeps the tab stop when nothing is checked", () => {
    // Deriving the roving tabindex from `aria-checked` would put every option at -1 here, and a
    // keyboard user could not tab into the control to fix the very state that broke it.
    const html = renderToStaticMarkup(<ThemeToggle mode={"auto" as ThemeMode} onModeChange={noop} />);
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(THEME_MODES.length - 1);
    // it is the FIRST option that holds it
    expect(html.indexOf('tabindex="0"')).toBeLessThan(html.indexOf('tabindex="-1"'));
    expect(themeToggleTabStop("auto" as ThemeMode)).toBe(0);
  });

  test("roving tabindex — the group is ONE tab stop, and it is themeToggleTabStop's", () => {
    for (const mode of THEME_MODES) {
      const html = renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} />);
      expect(html.match(/tabindex="0"/g)?.length).toBe(1);
      expect(html.match(/tabindex="-1"/g)?.length).toBe(THEME_MODES.length - 1);
      // …on the option the core names, not merely on some option
      const before = html.slice(0, html.indexOf('tabindex="0"'));
      expect({ mode, at: before.split("<button").length - 2 }).toEqual({
        mode,
        at: themeToggleTabStop(mode),
      });
    }
  });

  test("icon-only options carry a name; labelled ones let the visible word be the name", () => {
    const icons = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} />);
    for (const m of THEME_MODES) expect(icons).toContain(`aria-label="${THEME_MODE_LABELS[m]}"`);
    const labelled = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} labelled />);
    // naming it twice would have a reader announce "Light Light"
    expect(labelled).not.toContain("aria-label=\"Light\"");
    for (const m of THEME_MODES) expect(labelled).toContain(`>${THEME_MODE_LABELS[m]}<`);
  });

  test("each option wears its own glyph, drawn from the core's shape data", () => {
    const html = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} />);
    for (const m of THEME_MODES) {
      for (const shape of THEME_ICONS[THEME_MODE_ICONS[m]].shapes) {
        if (shape.kind === "path") expect(html).toContain(`d="${shape.d}"`);
        if (shape.kind === "circle") expect(html).toContain(`r="${shape.r}"`);
        if (shape.kind === "rect") expect(html).toContain(`width="${shape.width}"`);
      }
    }
    // decorative — the button already carries the name
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(THEME_MODES.length + 1); // + the knob
  });

  test("the cross-fade classes belong to the ICON member alone", () => {
    // Regression: deriving the glyph class from the glyph NAME put `.my-tt-icon__moon` — which
    // rests at opacity 0 — on this control's Dark option and on the switch's knob, rendering both
    // invisible. Only the icon button's stacked pair may wear them.
    for (const mode of THEME_MODES) {
      for (const labelled of [false, true]) {
        const html = renderToStaticMarkup(
          <ThemeToggle mode={mode} onModeChange={noop} labelled={labelled} />,
        );
        expect({ mode, labelled, html: html.includes(THEME_ICON_PARTS.sun) }).toEqual({
          mode,
          labelled,
          html: false,
        });
        expect({ mode, labelled, html: html.includes(THEME_ICON_PARTS.moon) }).toEqual({
          mode,
          labelled,
          html: false,
        });
      }
    }
    for (const checked of [true, false]) {
      const html = renderToStaticMarkup(<ThemeToggleSwitch checked={checked} onChange={noop} />);
      expect(html).not.toContain(THEME_ICON_PARTS.sun);
      expect(html).not.toContain(THEME_ICON_PARTS.moon);
    }
  });

  test("a truthy non-boolean `labelled` is NOT the labelled variant — class and markup agree", () => {
    // The core reads this opt-in flag with `=== true`. If the markup used raw truthiness instead,
    // `labelled={1}` would render words into the icon-only variant's 30px cells, with the class
    // string saying icon-only and the options silently losing their aria-label.
    const junk = renderToStaticMarkup(
      <ThemeToggle mode="system" onModeChange={noop} labelled={1 as unknown as boolean} />,
    );
    const plain = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} />);
    expect(junk).toBe(plain);
    expect(junk).toContain(`class="${themeToggleClass("system")} "`);
    for (const m of THEME_MODES) expect(junk).toContain(`aria-label="${THEME_MODE_LABELS[m]}"`);
  });

  test("the group's name is overridable, but never blank by accident", () => {
    expect(
      renderToStaticMarkup(<ThemeToggle mode="dark" onModeChange={noop} label="Appearance" />),
    ).toContain('aria-label="Appearance"');
    // An unusable override falls back rather than emitting `aria-label=""`, which would leave the
    // group announced as nothing at all.
    for (const junk of ["", "   ", undefined]) {
      expect({ junk, html: renderToStaticMarkup(
        <ThemeToggle mode="dark" onModeChange={noop} label={junk} />,
      ).includes(`aria-label="${THEME_TOGGLE_GROUP_LABEL}"`) }).toEqual({ junk, html: true });
    }
    expect(themeLabel("", THEME_TOGGLE_GROUP_LABEL)).toBe(THEME_TOGGLE_GROUP_LABEL);
  });

  test("the passthrough className is appended, never replaced", () => {
    expect(renderToStaticMarkup(<ThemeToggle mode="dark" onModeChange={noop} className="extra" />)).toContain(
      `class="${themeToggleClass("dark")} extra"`,
    );
  });

  test("rendering never invokes onModeChange — only a real activation may", () => {
    let calls = 0;
    renderToStaticMarkup(<ThemeToggle mode="light" onModeChange={() => (calls += 1)} />);
    expect(calls).toBe(0);
  });

  test("clicking an option reports it — and re-clicking the CURRENT one reports nothing", () => {
    // There is no DOM here, so the element's own handlers are invoked directly: that IS the wiring
    // a real click travels through. Re-selecting the active mode is not a change, and firing it
    // would make a controlled parent re-render (and re-persist) for nothing.
    const seen: ThemeMode[] = [];
    const options = segmentOptions(ThemeToggle({ mode: "light", onModeChange: (m) => void seen.push(m) }));
    for (const opt of options) (opt.props.onClick as () => void)();
    expect(seen).toEqual(["system", "dark"]);
  });

  test("arrow keys move the selection and are consumed; every other key is left alone", () => {
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", " ", "Tab"]) {
      const reported: ThemeMode[] = [];
      const vnode = ThemeToggle({ mode: "light", onModeChange: (m) => void reported.push(m) }) as {
        props: Record<string, unknown>;
      };
      let prevented = false;
      const group = fakeGroup();
      (vnode.props.onKeyDown as (e: unknown) => void)({
        key,
        currentTarget: group.node,
        preventDefault: () => void (prevented = true),
      });
      const action = themeToggleKeyAction(key);
      expect({ key, prevented, reported }).toEqual({
        key,
        prevented: action !== null,
        reported: action === null ? [] : [nextThemeMode("light", action)],
      });
    }
  });

  test("an arrow key moves FOCUS to the option it selected, and never scrolls the frame", () => {
    // preventScroll is load-bearing in this UI: a bare focus() scrolls every scrollable ancestor
    // and hides rows under the sticky 56px top bar this control lives in.
    for (const key of ["ArrowRight", "ArrowLeft"]) {
      const vnode = ThemeToggle({ mode: "light", onModeChange: () => {} }) as {
        props: Record<string, unknown>;
      };
      const group = fakeGroup();
      (vnode.props.onKeyDown as (e: unknown) => void)({
        key,
        currentTarget: group.node,
        preventDefault: () => {},
      });
      const action = themeToggleKeyAction(key)!;
      const wanted = THEME_MODES.indexOf(nextThemeMode("light", action));
      expect({ key, focused: group.focused }).toEqual({
        key,
        focused: [{ index: wanted, preventScroll: true }],
      });
    }
  });

  test("the option query the handler uses actually matches the options it renders", () => {
    // The keydown handler finds its buttons by attribute selector. If the rendered marker and the
    // selector ever diverged, focus would silently stop moving and nothing else would fail.
    const html = renderToStaticMarkup(<ThemeToggle mode="system" onModeChange={noop} />);
    expect(html.match(/data-tt-opt/g)?.length).toBe(THEME_MODES.length);
    const src = readFileSync(join(import.meta.dir, "src", "ThemeToggle.tsx"), "utf8");
    expect(src).toContain('"[data-tt-opt]"');
  });

  test("a keydown with no reachable group still reports the mode — focus is best-effort", () => {
    const reported: ThemeMode[] = [];
    const vnode = ThemeToggle({ mode: "light", onModeChange: (m) => void reported.push(m) }) as {
      props: Record<string, unknown>;
    };
    (vnode.props.onKeyDown as (e: unknown) => void)({
      key: "ArrowRight",
      currentTarget: null,
      preventDefault: () => {},
    });
    expect(reported).toEqual(["dark"]);
  });
});

describe("ThemeToggleIcon — the compact member", () => {
  test("the root class is themeIconClass(...), verbatim, in both variants", () => {
    expect(renderToStaticMarkup(<ThemeToggleIcon isDark={false} onToggle={noop} />)).toContain(
      `class="${themeIconClass()} "`,
    );
    expect(renderToStaticMarkup(<ThemeToggleIcon isDark={false} onToggle={noop} bordered />)).toContain(
      `class="${themeIconClass({ bordered: true })} "`,
    );
  });

  test("it is a named toggle button whose state rides aria-pressed", () => {
    for (const isDark of [true, false]) {
      const html = renderToStaticMarkup(<ThemeToggleIcon isDark={isDark} onToggle={noop} />);
      expect(html).toContain('<button type="button"');
      expect(html).toContain(`aria-label="${THEME_ICON_LABEL}"`);
      expect(html).toContain(`aria-pressed="${isDark}"`);
    }
  });

  test("BOTH glyphs are always in the DOM — that is what makes it a cross-fade", () => {
    for (const isDark of [true, false]) {
      const html = renderToStaticMarkup(<ThemeToggleIcon isDark={isDark} onToggle={noop} />);
      expect(html).toContain(THEME_ICON_PARTS.sun);
      expect(html).toContain(THEME_ICON_PARTS.moon);
      expect(html).toContain(`class="${THEME_ICON_PARTS.stack}"`);
      expect(html).toContain(THEME_ICONS.sun.shapes[1]?.kind === "path" ? THEME_ICONS.sun.shapes[1].d : "");
      expect(html).toContain((THEME_ICONS.moon.shapes[0] as { d: string }).d);
    }
  });

  test("its name is overridable, but a blank override falls back rather than erasing it", () => {
    expect(
      renderToStaticMarkup(<ThemeToggleIcon isDark={false} onToggle={noop} label="Switch theme" />),
    ).toContain('aria-label="Switch theme"');
    for (const junk of ["", "  ", undefined]) {
      expect({ junk, ok: renderToStaticMarkup(
        <ThemeToggleIcon isDark={false} onToggle={noop} label={junk} />,
      ).includes(`aria-label="${THEME_ICON_LABEL}"`) }).toEqual({ junk, ok: true });
    }
  });

  test("clicking asks for the OPPOSITE theme — never System", () => {
    for (const isDark of [true, false]) {
      const seen: string[] = [];
      const vnode = ThemeToggleIcon({ isDark, onToggle: (t) => void seen.push(t) }) as {
        props: Record<string, unknown>;
      };
      (vnode.props.onClick as () => void)();
      expect(seen).toEqual([themeIconTarget(isDark)]);
      expect(seen).not.toContain("system");
    }
  });

  test("rendering never invokes onToggle", () => {
    let calls = 0;
    renderToStaticMarkup(<ThemeToggleIcon isDark onToggle={() => (calls += 1)} />);
    expect(calls).toBe(0);
  });
});

describe("ThemeToggleSwitch — the settings-row member", () => {
  test("a real checkbox inside a label, with the card's parts", () => {
    const html = renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} />);
    expect(html.startsWith("<label")).toBe(true);
    expect(html).toContain(`class="${THEME_SWITCH_PARTS.root} "`);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain(`class="${THEME_SWITCH_PARTS.input}"`);
    expect(html).toContain(`class="${THEME_SWITCH_PARTS.track}"`);
    expect(html).toContain(`class="${THEME_SWITCH_PARTS.knob}"`);
  });

  test("the checked state is the input's own, in both directions", () => {
    expect(renderToStaticMarkup(<ThemeToggleSwitch checked onChange={noop} />)).toContain("checked");
    expect(renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} />)).not.toContain(
      " checked",
    );
  });

  test("the knob carries the theme you are IN", () => {
    for (const checked of [true, false]) {
      const html = renderToStaticMarkup(<ThemeToggleSwitch checked={checked} onChange={noop} />);
      const wanted = THEME_ICONS[themeGlyph(checked)];
      const other = THEME_ICONS[themeGlyph(!checked)];
      const wantedPath = wanted.shapes.find((s) => s.kind === "path") as { d: string };
      const otherPath = other.shapes.find((s) => s.kind === "path") as { d: string };
      expect(html).toContain(wantedPath.d);
      expect(html).not.toContain(otherPath.d);
    }
  });

  test("with visible text the label names it; without, it falls back to the card's name", () => {
    const withText = renderToStaticMarkup(
      <ThemeToggleSwitch checked={false} onChange={noop}>
        Dark mode
      </ThemeToggleSwitch>,
    );
    // the wrapping <label> already names the input — a second name would win and could disagree
    expect(withText).not.toContain("aria-label=");
    expect(withText).toContain("Dark mode");

    const bare = renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} />);
    expect(bare).toContain(`aria-label="${THEME_SWITCH_LABEL}"`);
    expect(
      renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} label="Appearance" />),
    ).toContain('aria-label="Appearance"');
  });

  test("children that render NOTHING are not visible text either", () => {
    // `children=""`, whitespace, or an array of nothing all leave the checkbox with no text. Being
    // fooled by any of them would ship a nameless control.
    for (const empty of ["", "   ", [], [false, null]] as const) {
      const html = renderToStaticMarkup(
        <ThemeToggleSwitch checked={false} onChange={noop}>
          {empty}
        </ThemeToggleSwitch>,
      );
      expect({ empty, named: html.includes(`aria-label="${THEME_SWITCH_LABEL}"`) }).toEqual({
        empty,
        named: true,
      });
    }
  });

  test("children this binding cannot READ do not suppress the name", () => {
    // An element is opaque to a render-only binding: `<></>`, a component returning null and a
    // <span> full of words are indistinguishable. Trusting one to name the input is what would
    // ship a nameless checkbox; keeping the explicit name at worst names it twice.
    for (const opaque of [<></>, <span />, <b>Dark mode</b>]) {
      const html = renderToStaticMarkup(
        <ThemeToggleSwitch checked={false} onChange={noop}>
          {opaque}
        </ThemeToggleSwitch>,
      );
      expect(html).toContain(`aria-label="${THEME_SWITCH_LABEL}"`);
    }
  });

  test("plain text DOES name it — no aria-label, so the visible words are the name", () => {
    for (const text of ["Dark mode", ["Dark ", "mode"], 0] as const) {
      const html = renderToStaticMarkup(
        <ThemeToggleSwitch checked={false} onChange={noop}>
          {text}
        </ThemeToggleSwitch>,
      );
      expect({ text, named: html.includes("aria-label=") }).toEqual({ text, named: false });
    }
  });

  test("a blank `label` falls back — the control is never announced as nothing", () => {
    for (const junk of ["", "   ", undefined]) {
      const html = renderToStaticMarkup(
        <ThemeToggleSwitch checked={false} onChange={noop} label={junk} />,
      );
      expect({ junk, named: html.includes(`aria-label="${THEME_SWITCH_LABEL}"`) }).toEqual({
        junk,
        named: true,
      });
      expect(html).not.toContain('aria-label=""');
    }
  });

  test("a falsy child is not visible text — the fallback name still applies", () => {
    // `{showLabel && "Dark mode"}` passes `false`, not undefined. Treating that as text would
    // leave the control with no accessible name at all.
    const html = renderToStaticMarkup(
      <ThemeToggleSwitch checked={false} onChange={noop}>
        {false}
      </ThemeToggleSwitch>,
    );
    expect(html).toContain(`aria-label="${THEME_SWITCH_LABEL}"`);
  });

  test("disabled is ANNOUNCED by the input, not merely painted on the label", () => {
    const html = renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} disabled />);
    expect(html).toContain("disabled"); // the real, native one on the input
    expect(html).toContain('aria-disabled="true"'); // the card's paint hook on the label
    expect(renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} />)).not.toContain(
      "aria-disabled",
    );
  });

  test("rendering never invokes onChange", () => {
    let calls = 0;
    renderToStaticMarkup(<ThemeToggleSwitch checked onChange={() => (calls += 1)} />);
    expect(calls).toBe(0);
  });
});

describe("the family emits no inline styles (CSP style-src 'self')", () => {
  test("no render of any member carries a style attribute", () => {
    // The card's demo writes --x1/--x2 and a knob width as inline styles; this port derives them
    // in CSS instead, and this is what keeps it that way.
    const renders = [
      ...THEME_MODES.flatMap((mode) => [
        renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} />),
        renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} labelled />),
      ]),
      renderToStaticMarkup(<ThemeToggleIcon isDark onToggle={noop} bordered />),
      renderToStaticMarkup(<ThemeToggleIcon isDark={false} onToggle={noop} />),
      renderToStaticMarkup(<ThemeToggleSwitch checked onChange={noop}>Dark mode</ThemeToggleSwitch>),
      renderToStaticMarkup(<ThemeToggleSwitch checked={false} onChange={noop} disabled />),
    ];
    for (const html of renders) expect(html).not.toContain("style=");
  });

  test("every class every member emits resolves in ui-core's styles.css", () => {
    const css = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");
    const renders = [
      ...THEME_MODES.flatMap((mode) => [
        renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} />),
        renderToStaticMarkup(<ThemeToggle mode={mode} onModeChange={noop} labelled />),
      ]),
      // the degraded `nothing selected` state emits a class of its own, so it is swept too
      renderToStaticMarkup(<ThemeToggle mode={"auto" as ThemeMode} onModeChange={noop} />),
      renderToStaticMarkup(<ThemeToggleIcon isDark onToggle={noop} bordered />),
      renderToStaticMarkup(<ThemeToggleSwitch checked onChange={noop} disabled />),
    ];
    const emitted = new Set<string>();
    for (const html of renders) {
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
      }
    }
    expect(emitted.size).toBeGreaterThan(8);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const missing = [...emitted].filter((c) => !new RegExp(`\\.${escape(c)}(?![\\w-])`).test(css));
    expect(missing).toEqual([]);
  });
});

describe("the binding decides nothing — every string comes from the core", () => {
  test("the source hard-codes no class name, glyph path or copy of its own", () => {
    const src = readFileSync(join(import.meta.dir, "src", "ThemeToggle.tsx"), "utf8");
    // A literal `my-tt-…` here would be a second source of truth for a class string.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/["'`]my-tt-/);
    // …and no SVG path data either: the shapes come from THEME_ICONS.
    expect(code).not.toMatch(/d=["']M/);
  });
});
