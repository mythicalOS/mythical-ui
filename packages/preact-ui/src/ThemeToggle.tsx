/** @jsxImportSource preact */
// @mythicalos/preact-ui — the theme toggle family (ds/components-theme-toggle): one component,
// three members, so every product stops rolling its own.
//
//   ThemeToggle        segmented, the DEFAULT — a three-mode radiogroup (system | light | dark)
//                      with System as a first-class choice. Icon-only and labelled variants.
//   ThemeToggleIcon    a single 30px button for a crowded top bar. Skips System.
//   ThemeToggleSwitch  a settings row ONLY, under a heading that already says "Dark mode".
//
// All three are CONTROLLED and own no state: they render what they are handed and report what the
// user asked for. They do NOT persist anything, do not read `matchMedia`, and do not write
// `data-theme` anywhere — a component that quietly owned the app's theme would be impossible to
// drive from a settings page and a router at the same time. Resolving `system` to a real theme is
// `resolveThemeIsDark(mode, systemPrefersDark)` in the core, called by whoever owns the media
// query.
//
// This file is WIRING ONLY: every class string, glyph path, aria string and the keyboard grammar
// are derived by `@mythicalos/ui-core`, so this binding and its React sibling cannot drift. The two
// things the core cannot do are all this file adds: rendering, and moving focus.

import type { ComponentChildren } from "preact";
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
  nextThemeMode,
  themeGlyph,
  themeIconClass,
  themeIconTarget,
  themeLabel,
  themeModeIndex,
  themeSwitchHasReadableText,
  themeToggleClass,
  themeToggleKeyAction,
  themeToggleTabStop,
  type ResolvedTheme,
  type ThemeIconName,
  type ThemeMode,
} from "@mythicalos/ui-core/logic";

export {
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
  type ResolvedTheme,
  type ThemeIconName,
  type ThemeMode,
  type ThemeToggleKeyAction,
} from "@mythicalos/ui-core/logic";

/** One glyph, drawn from the core's shape data so both bindings emit identical SVG. Decorative in
 *  every placement here — each control carries its own accessible name — so it is hidden from the
 *  accessibility tree rather than announced as an unnamed image.
 *
 *  `class` is passed in rather than derived from `name`: only the ICON member's stacked pair wears
 *  the cross-fade classes, and deriving them here would put `.my-tt-icon__moon` — which rests at
 *  `opacity: 0` — on the segmented control's Dark option and the switch's own knob, rendering both
 *  invisible. */
function ThemeIcon({ name, class: cls }: { name: ThemeIconName; class?: string }) {
  const spec = THEME_ICONS[name];
  return (
    <svg
      viewBox={spec.viewBox}
      fill={THEME_ICON_STROKE.fill}
      stroke={THEME_ICON_STROKE.stroke}
      stroke-width={THEME_ICON_STROKE.strokeWidth}
      stroke-linecap={THEME_ICON_STROKE.strokeLinecap}
      stroke-linejoin={spec.roundJoins ? "round" : undefined}
      aria-hidden="true"
      class={cls}
    >
      {spec.shapes.map((shape, i) =>
        shape.kind === "circle" ? (
          <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />
        ) : shape.kind === "rect" ? (
          <rect key={i} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />
        ) : (
          <path key={i} d={shape.d} />
        ),
      )}
    </svg>
  );
}

export interface ThemeToggleProps {
  /** The mode currently in force. CONTROLLED — this component never changes it on its own. */
  mode: ThemeMode;
  /** The mode the user asked for. Fires on click and on an arrow key. */
  onModeChange: (mode: ThemeMode) => void;
  /** The card's labelled variant: each option shows its word beside the glyph. Icon-only (the
   *  default) is the top-bar form; the labelled one belongs in a settings row. */
  labelled?: boolean;
  /** Override the group's accessible name. Defaults to the card's "Colour theme". */
  label?: string;
  class?: string;
}

/**
 * The segmented member — a real radiogroup.
 *
 * Roving tabindex, per the WAI-ARIA radio-group pattern: the group is ONE tab stop and the arrows
 * move within it, so Tab does not have to walk three buttons to leave a preference control. The
 * card's demo leaves all three natively focusable; that is a demo, and this is the component every
 * product will use. When the mode is not one of the three, NOTHING is checked — no option may
 * claim a selection the caller never made — but the first one still holds the tab stop, because a
 * group nobody can tab into is a worse answer than a group with no selection yet.
 *
 * Focus follows selection on an arrow key, which is what makes selection-follows-focus honest: the
 * mode reported and the option focused are always the same one. It moves synchronously in the
 * handler, on a node already in the DOM, so it does not depend on the caller accepting the change.
 *
 * NO HOOKS, deliberately. The group element the arrow keys have to reach for is the keydown's own
 * `currentTarget`, so a ref would be a second, weaker way to name something the event already
 * hands over — and a hook-free component is one a test can call directly, which is the only way to
 * exercise these handlers in a package whose test runtime has no DOM.
 */
export function ThemeToggle(props: ThemeToggleProps) {
  const { mode, onModeChange, class: cls = "" } = props;
  // Normalized ONCE. The core reads `labelled` with `=== true` (an opt-in flag must not
  // switch variants on a truthy accident), so deriving the markup from raw truthiness would
  // let a JS consumer's `labelled={1}` render words into the icon-only variant's 30px cells,
  // with the class string saying otherwise and the options losing their aria-label.
  const labelled = props.labelled === true;
  // The group's one tab stop. Normally the selected option; with an unrecognised mode nothing is
  // checked, and the first option takes it so the control stays reachable at all.
  const tabStop = themeToggleTabStop(mode);

  const select = (next: ThemeMode) => {
    // Re-selecting the mode already in force is not a change: reporting it would make a controlled
    // parent re-render, and re-persist, for nothing.
    if (next !== mode) onModeChange(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const action = themeToggleKeyAction(e.key);
    if (action === null) return; // never swallow a key this component does not own
    e.preventDefault();
    const next = nextThemeMode(mode, action);
    // preventScroll: a bare focus() asks every scrollable ancestor to reveal the button, which
    // yanks the page frame out from under a control that lives in a sticky top bar.
    const group = e.currentTarget as HTMLElement | null;
    group
      ?.querySelectorAll<HTMLButtonElement>("[data-tt-opt]")
      ?.[themeModeIndex(next)]?.focus({ preventScroll: true });
    select(next);
  };

  return (
    <div
      class={`${themeToggleClass(mode, { labelled })} ${cls}`}
      role="radiogroup"
      aria-label={themeLabel(props.label, THEME_TOGGLE_GROUP_LABEL)}
      onKeyDown={onKeyDown}
    >
      {/* Decorative: the selection is announced by aria-checked below, never by this <span>. */}
      <span class={THEME_TOGGLE_PARTS.knob} aria-hidden="true" />
      {THEME_MODES.map((m, i) => (
        <button
          key={m}
          type="button"
          data-tt-opt
          class={THEME_TOGGLE_PARTS.option}
          role="radio"
          aria-checked={m === mode ? "true" : "false"}
          // The labelled variant's visible word IS the name; naming it twice would have a reader
          // announce "Light Light". Icon-only has no text at all, so it must carry one.
          aria-label={labelled ? undefined : THEME_MODE_LABELS[m]}
          tabIndex={i === tabStop ? 0 : -1}
          onClick={() => select(m)}
        >
          <ThemeIcon name={THEME_MODE_ICONS[m]} />
          {labelled ? THEME_MODE_LABELS[m] : null}
        </button>
      ))}
    </div>
  );
}

export interface ThemeToggleIconProps {
  /** Is the dark theme in force RIGHT NOW — already resolved, so `system` is the caller's problem
   *  and this button never has to guess. */
  isDark: boolean;
  /** The theme the user asked for: `themeIconTarget(isDark)`, so always the opposite of `isDark`.
   *  Never `system` — this member has no System (use the segmented one). */
  onToggle: (next: ResolvedTheme) => void;
  /** The card's `.bord` — a visible boundary for a standalone/toolbar placement. */
  bordered?: boolean;
  /** Override the accessible name. Defaults to the card's "Toggle theme". */
  label?: string;
  class?: string;
}

/**
 * The icon member. Both glyphs are always in the DOM, stacked in one grid cell — that is what makes
 * the cross-fade a cross-fade rather than a swap, and it is why the visible one is chosen in CSS
 * from `aria-pressed` rather than here. The button shows the theme you would GET.
 */
export function ThemeToggleIcon(props: ThemeToggleIconProps) {
  const { isDark, onToggle, bordered = false, class: cls = "" } = props;
  return (
    <button
      type="button"
      class={`${themeIconClass({ bordered })} ${cls}`}
      aria-label={themeLabel(props.label, THEME_ICON_LABEL)}
      aria-pressed={isDark ? "true" : "false"}
      onClick={() => onToggle(themeIconTarget(isDark))}
    >
      <span class={THEME_ICON_PARTS.stack}>
        <ThemeIcon name="sun" class={THEME_ICON_PARTS.sun} />
        <ThemeIcon name="moon" class={THEME_ICON_PARTS.moon} />
      </span>
    </button>
  );
}

export interface ThemeToggleSwitchProps {
  /** Is dark mode on? CONTROLLED. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name, rendered as visually-hidden text ONLY when `children` carry no text this
   *  binding can read — the settings-row placement, where the row's own heading is the visible
   *  label. Defaults to the card's "Dark mode". */
  label?: string;
  class?: string;
  /** Visible text inside the label. Omit in a settings row whose heading already says it. Plain
   *  text (and arrays of it) IS the control's name, through the wrapping <label>. Richer markup is
   *  opaque to a render-only binding, so the hidden fallback name is added alongside it; pass
   *  `label` when that rich text says something other than the default. */
  children?: ComponentChildren;
}

/**
 * The switch member. Settings rows only, and only under a label that already says "Dark mode" —
 * on/off says nothing about WHICH theme without that sentence, which is exactly why the segmented
 * member is the default.
 *
 * A real `<input type="checkbox">` inside a `<label>`: the input carries the role, the checked
 * state, focus and the space bar, and the wrapper names it. When the caller renders no text this
 * binding can read, a visually-hidden name joins the label's contents — never an `aria-label`,
 * which would override visible words rather than stand in for absent ones.
 * `aria-disabled` on the label is the card's PAINT hook only; the disabled semantics are the
 * input's own native `disabled`, so the look can never appear without the behaviour.
 */
export function ThemeToggleSwitch(props: ThemeToggleSwitchProps) {
  const { checked, onChange, disabled = false, class: cls = "" } = props;
  const hasText = themeSwitchHasReadableText(props.children);
  return (
    <label
      class={`${THEME_SWITCH_PARTS.root} ${cls}`}
      aria-disabled={disabled ? "true" : undefined}
    >
      <input
        type="checkbox"
        class={THEME_SWITCH_PARTS.input}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span class={THEME_SWITCH_PARTS.track}>
        <span class={THEME_SWITCH_PARTS.knob}>
          <ThemeIcon name={themeGlyph(checked)} />
        </span>
      </span>
      {props.children}
      {/* The name, when the caller renders no text this binding can read. A hidden sibling rather
          than an aria-label, so it ADDS to any visible words instead of overriding them — see
          themeSwitchHasReadableText for the three cases. */}
      {hasText ? null : (
        <span class={THEME_SWITCH_PARTS.name}>{themeLabel(props.label, THEME_SWITCH_LABEL)}</span>
      )}
    </label>
  );
}
