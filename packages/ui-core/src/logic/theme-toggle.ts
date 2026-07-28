// @mythicalos/ui-core — the THEME TOGGLE family: mode resolution, class derivation, the radiogroup
// keyboard grammar, the icon geometry and the copy for the design system's "Theme toggle —
// segmented, icon & switch" card. One component, three members, so every product stops rolling its
// own:
//
//   ThemeToggle        segmented, the DEFAULT. A three-mode radiogroup — system | light | dark —
//                      with System as a first-class choice, not a checkbox's implied absence. Quiet
//                      --my-track pill, a raised --my-surface knob sliding on --my-t-base, and the
//                      accent on the GLYPH; never a filled accent pill (the card's don't-panel:
//                      "a saturated track turns a preference into a call to action").
//   ThemeToggleIcon    a single 30px button for a crowded top bar. Skips System, cross-fades
//                      sun↔moon, `aria-pressed` carries the state.
//   ThemeToggleSwitch  settings rows ONLY, under a label that already says "Dark mode". Same on/off
//                      vocabulary as the inputs Toggle; the knob carries the sun/moon glyph.
//
// This module is PURE: no DOM, no `window`, no `matchMedia`. Resolving "system" needs a media query
// the host owns, so it is a PARAMETER here (`systemPrefersDark`) rather than something this module
// reaches out and reads — that is what keeps the two bindings, SSR and a test able to share one
// implementation. The bindings own exactly two things this module cannot: touching the DOM
// (focusing) and rendering.
//
// PERSISTENCE IS NOT HERE EITHER, and not in the bindings. The component is controlled: it renders
// the mode it is handed and reports the mode the user asked for. Which storage a product uses, and
// whether it writes `data-theme` on <html> or on a subtree, is the product's decision.
//
// The port needs no geometry of its own. The card's two segmented variants raise the selection two
// different ways, and both are pure CSS: the ICON-ONLY variant slides a single knob between three
// fixed 30px cells, and the LABELLED variant hides that knob and lets the checked BUTTON carry the
// raised look, so its content-width options need no measurement. That matters here because the
// image runs under `style-src 'self'` — an inline style, which is how a measured layout would have
// to be applied, is a CSP violation, and these bindings are render-only.

/** The three modes, in card order. The INDEX is load-bearing: it is the knob's resting position,
 *  and the arrow keys walk this array. */
export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** The mode the icon member can switch BETWEEN — it deliberately has no System. */
export type ResolvedTheme = "light" | "dark";

/** The glyphs the card draws. `system` appears only in the segmented member. */
export type ThemeIconName = "sun" | "moon" | "system";

export function isThemeMode(mode: unknown): mode is ThemeMode {
  return (THEME_MODES as readonly unknown[]).includes(mode);
}

/** Index of `mode` in {@link THEME_MODES}, or -1 for anything else. */
export function themeModeIndex(mode: ThemeMode): number {
  return (THEME_MODES as readonly unknown[]).indexOf(mode);
}

// ── mode resolution ────────────────────────────────────────────────────────────────────────────

/**
 * Does this mode render dark? The whole point of keeping `system` as a real mode rather than a
 * boolean is that the answer depends on something outside the component, so the caller supplies it:
 * `matchMedia("(prefers-color-scheme: dark)").matches`, or whatever the host can actually observe.
 *
 * `light`/`dark` are explicit and ignore the system entirely — that IS the choice the user made.
 * Everything else (including a mode string a JS consumer invented) follows the system, which is the
 * card's default and the only answer that is never a lie about what the user picked.
 *
 * `systemPrefersDark` defaults to `false` — LIGHT — when the host cannot measure it. The token set
 * is light-first, so an unmeasurable system preference renders the documented default rather than
 * guessing dark.
 *
 * ON TRUTHINESS, because this module is deliberately inconsistent about it and the split is the
 * point. The three FACT parameters here (`systemPrefersDark`, and `isDark`/`checked` below) are
 * ordinary truthiness: a JS consumer handing `1` for "yes, dark" means yes, and answering "light"
 * would be a wrong answer, not a safe one. The optional STATE flags (`labelled`, `bordered`) are
 * compared with `=== true` instead, matching `chipClass`: those are opt-ins, and a truthy accident
 * must not silently switch a component into a different variant.
 */
export function resolveThemeIsDark(mode: ThemeMode, systemPrefersDark: boolean = false): boolean {
  if (mode === "light") return false;
  if (mode === "dark") return true;
  return Boolean(systemPrefersDark);
}

/**
 * What the icon member switches TO — the opposite of what is on screen now.
 *
 * It never returns `system`: the card's icon member is the compact top-bar control and explicitly
 * skips System, because a two-state button cannot honestly offer a third state. A product that
 * needs System reaches for the segmented member.
 */
export function themeIconTarget(isDark: boolean): ResolvedTheme {
  return isDark ? "light" : "dark";
}

/**
 * Which glyph names the theme in force: moon while dark, sun while light — the theme you are IN,
 * not the one a click would give you.
 *
 * ONE function for both members that need it, because they genuinely agree. The icon button shows
 * the current theme (card: "shows the theme you're in — sun on light, moon on dark", and its
 * cross-fade rules paint exactly that), and the switch knob decorates the state it is in (sun on
 * the card's light panel, moon on its dark one). Two functions returning the same answer would be
 * two places for it to stop being the same answer.
 *
 * The icon member renders BOTH glyphs and lets CSS choose from `aria-pressed`, which is what makes
 * the change a cross-fade rather than a swap; this is the derivation its stylesheet rules are
 * pinned against in test/css-theme-toggle.test.ts. The switch renders only the one.
 */
export function themeGlyph(isDark: boolean): ThemeIconName {
  return isDark ? "moon" : "sun";
}

// ── the radiogroup keyboard grammar ────────────────────────────────────────────────────────────

/** `next`/`prev` move the selection; `null` is a key this component does not handle and must not
 *  swallow. */
export type ThemeToggleKeyAction = "next" | "prev" | null;

/**
 * What a key pressed inside the segmented control means.
 *
 * Both axes are live, per the WAI-ARIA radiogroup pattern: Right/Down advance, Left/Up retreat.
 * The card's demo binds only Left/Right, but a radiogroup that ignores the vertical arrows is a
 * radiogroup only by attribute, and the brief asks for radiogroup semantics. Enter and Space are
 * absent on purpose — the options are real <button>s, so the browser already synthesises a click.
 */
export function themeToggleKeyAction(key: string): ThemeToggleKeyAction {
  if (key === "ArrowRight" || key === "ArrowDown") return "next";
  if (key === "ArrowLeft" || key === "ArrowUp") return "prev";
  return null;
}

/**
 * The mode an arrow key lands on, wrapping — the card's `(i + d + n) % n`.
 *
 * A `null` action leaves the mode alone, so a binding never has to branch on the action twice. An
 * unrecognised current mode has no position to step from: `next` then means the FIRST mode and
 * `prev` the LAST, rather than an arithmetic accident off index -1 (which would silently make
 * `next` land on `system` and `prev` on `dark` — right by luck for one direction only).
 */
export function nextThemeMode(mode: ThemeMode, action: ThemeToggleKeyAction): ThemeMode {
  if (action === null) return mode;
  const n = THEME_MODES.length;
  const at = themeModeIndex(mode);
  if (at < 0) return (action === "next" ? THEME_MODES[0] : THEME_MODES[n - 1]) as ThemeMode;
  const dir = action === "next" ? 1 : -1;
  return THEME_MODES[(((at + dir) % n) + n) % n] as ThemeMode;
}

/**
 * Which option index is the group's single tab stop.
 *
 * The selected one — except when the mode is not one of the three, where NOTHING is selected and
 * the first option takes it. That is the WAI-ARIA radio-group rule for a group with no checked
 * radio, and it is the only answer that keeps the control REACHABLE without lying: a roving
 * tabindex derived straight from `aria-checked` would leave every option at -1, so a keyboard user
 * could not tab to the group at all and would have no way to fix the very state that broke it.
 * `aria-checked` stays false everywhere — being focusable is not a claim to be selected.
 */
export function themeToggleTabStop(mode: ThemeMode): number {
  const at = themeModeIndex(mode);
  return at >= 0 ? at : 0;
}

// ── accessible names ───────────────────────────────────────────────────────────────────────────

/**
 * A caller-supplied accessible name, or the fallback when it is not a usable one.
 *
 * Runtime-checked, because these are public props of a published package and TypeScript is not
 * there at the call site. `label=""` (or whitespace, or a non-string from a JS consumer) would
 * otherwise emit an EMPTY accessible name, which is strictly worse than no override: a control
 * named "" is announced as nothing at all, where the default at least says what it is. Same
 * contract, and the same reasoning, as `revealName` in the Input atom's reveal affordance.
 */
export function themeLabel(supplied: unknown, fallback: string): string {
  return typeof supplied === "string" && supplied.trim().length > 0 ? supplied : fallback;
}

/**
 * Does the switch's `children` slot render text a screen reader can use as the control's name?
 *
 * This decides whether the input carries its own `aria-label`, so getting it wrong in either
 * direction is an accessibility defect: a false positive leaves the checkbox nameless, a false
 * negative overrides visible text with a name that may disagree with it (WCAG 2.5.3).
 *
 * `undefined`/`null`/`true`/`false` are all "nothing" — the idiomatic conditional slot is
 * `{showLabel && "Dark mode"}`, which passes `false`, not `undefined`. `""` and whitespace are
 * nothing too, and an array is judged by its members, so `{[]}` and `{[false, null]}` are nothing
 * as well. This is `popoverHasSlotContent`'s rule extended down through arrays.
 *
 * DOCUMENTED RESIDUAL: a framework element that happens to render nothing — `<></>`, or a
 * component returning `null` — reads as content here, because a render-only binding cannot look
 * inside it without invoking it. A caller in that position should pass no children at all (the
 * settings-row placement the card draws), which is unambiguous.
 */
export function themeSwitchHasText(children: unknown): boolean {
  if (children === undefined || children === null || typeof children === "boolean") return false;
  if (typeof children === "string") return children.trim().length > 0;
  if (Array.isArray(children)) return children.some((child) => themeSwitchHasText(child));
  return true;
}

// ── class derivation ───────────────────────────────────────────────────────────────────────────

/** Every class the segmented member renders. The bindings import these rather than spelling the
 *  strings, so the two frameworks cannot drift apart on a rename. */
export const THEME_TOGGLE_PARTS = {
  root: "my-tt-seg",
  /** The raised sliding tile of the ICON-ONLY variant. Decorative and `aria-hidden`: the selection
   *  is announced by `aria-checked` on the options, never by a floating <span>. The labelled
   *  variant hides it in CSS and raises the checked button instead — it is still rendered there,
   *  exactly as the card renders it, so the two variants share one piece of markup. */
  knob: "my-tt-seg__knob",
  /** One mode. A real <button role="radio">. */
  option: "my-tt-seg__opt",
} as const;

export interface ThemeToggleState {
  /** The card's `.lab` — each option shows its word beside the glyph, options size to their
   *  content, and the raised look moves from the sliding knob onto the checked button. */
  labelled?: boolean;
}

/**
 * Root class: base + the optional labelled modifier + the selected-mode modifier.
 *
 * The selected mode rides the ROOT rather than a data attribute because it is what positions the
 * knob, and the knob is a sibling of the options, not a child of the selected one — CSS has no way
 * back up from `[aria-checked="true"]` to a preceding sibling without `:has()`, which nothing in
 * this sheet uses yet.
 *
 * An unrecognised mode degrades to `system`: the knob parks at rest (index 0) rather than emitting
 * a `--sel-<junk>` modifier with no rule behind it, which would strand the knob at index 0 anyway
 * but with a class that silently means nothing. Same degradation contract as `chipClass`.
 */
export function themeToggleClass(mode: ThemeMode, state: ThemeToggleState = {}): string {
  const base = THEME_TOGGLE_PARTS.root;
  const selected = isThemeMode(mode) ? mode : "system";
  let cls = base;
  if (state?.labelled === true) cls += ` ${base}--lab`;
  return `${cls} ${base}--sel-${selected}`;
}

/** Every class the icon member renders. */
export const THEME_ICON_PARTS = {
  root: "my-tt-icon",
  /** The two glyphs, stacked in one grid cell so they can cross-fade instead of swapping. */
  stack: "my-tt-icon__stack",
  sun: "my-tt-icon__sun",
  moon: "my-tt-icon__moon",
} as const;

export interface ThemeIconState {
  /** The card's `.bord` — a visible control boundary for a standalone/toolbar placement. Bare (no
   *  boundary) is the top-bar default. */
  bordered?: boolean;
}

/** Root class: base + the bordered modifier. The pressed state is NOT a class — it rides
 *  `aria-pressed`, which the stylesheet targets directly, so the cross-fade cannot be painted
 *  without also announcing it. */
export function themeIconClass(state: ThemeIconState = {}): string {
  const base = THEME_ICON_PARTS.root;
  return state?.bordered === true ? `${base} ${base}--bordered` : base;
}

/** Every class the switch member renders. There is no root class FUNCTION because there is no root
 *  modifier: the checked state rides the input's own `:checked`, and disabled rides `aria-disabled`
 *  on the label plus the input's native `disabled`. Neither state can be painted without being
 *  real, which is the point. */
export const THEME_SWITCH_PARTS = {
  root: "my-tt-switch",
  /** The visually-hidden real <input type="checkbox">. It is hidden, never removed: it is what
   *  carries the checkbox role, the checked state, focus and the space-bar. */
  input: "my-tt-switch__input",
  track: "my-tt-switch__track",
  /** Carries the sun/moon glyph. */
  knob: "my-tt-switch__knob",
} as const;

// ── copy ───────────────────────────────────────────────────────────────────────────────────────

/** The accessible name of each option, and the labelled variant's visible word — one string for
 *  both, exactly as the card draws it. */
export const THEME_MODE_LABELS: Readonly<Record<ThemeMode, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** The radiogroup's accessible name, verbatim from the card (British spelling and all). */
export const THEME_TOGGLE_GROUP_LABEL = "Colour theme";
/** The icon member's accessible name. Static: the button's meaning does not change with the
 *  theme — `aria-pressed` carries the state, so the name must not also try to. */
export const THEME_ICON_LABEL = "Toggle theme";
/** The switch member's accessible name when the caller renders no visible text of its own (the
 *  settings-row placement, where the row's own heading is the visible label). Not a guess: this
 *  member exists only for a row that already says "Dark mode". */
export const THEME_SWITCH_LABEL = "Dark mode";

// ── icon geometry ──────────────────────────────────────────────────────────────────────────────
//
// The card's three SVGs, as data, so both bindings draw the same paths from one source and a test
// can assert they did. Stroke geometry (fill none / stroke currentColor / width 2 / round caps) is
// shared by all three; only the moon and the system glyph add round JOINS, exactly as drawn.
//
// No width/height attributes: the sheet sizes them per member (14px segmented, 16px icon, 9px
// switch knob), which is how one glyph serves three sizes.

export type ThemeIconShape =
  | { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly kind: "rect";
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly rx: number;
    }
  | { readonly kind: "path"; readonly d: string };

export interface ThemeIconSpec {
  readonly viewBox: string;
  /** `true` for the glyphs the card gives `stroke-linejoin="round"`. The sun is all caps and
   *  straight rays — it has no joins to round, and the card omits it there. */
  readonly roundJoins: boolean;
  readonly shapes: readonly ThemeIconShape[];
}

/** Shared by all three glyphs. */
export const THEME_ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
} as const;

export const THEME_ICONS: Readonly<Record<ThemeIconName, ThemeIconSpec>> = {
  sun: {
    viewBox: "0 0 24 24",
    roundJoins: false,
    shapes: [
      { kind: "circle", cx: 12, cy: 12, r: 4.2 },
      {
        kind: "path",
        d: "M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6",
      },
    ],
  },
  moon: {
    viewBox: "0 0 24 24",
    roundJoins: true,
    shapes: [{ kind: "path", d: "M20.5 14.4A8.6 8.6 0 1 1 9.6 3.5a6.9 6.9 0 0 0 10.9 10.9Z" }],
  },
  system: {
    viewBox: "0 0 24 24",
    roundJoins: true,
    shapes: [
      { kind: "rect", x: 2.8, y: 4, width: 18.4, height: 12.4, rx: 2 },
      { kind: "path", d: "M8.6 20.4h6.8M12 16.4v4" },
    ],
  },
};

/** The glyph each mode wears in the segmented member. */
export const THEME_MODE_ICONS: Readonly<Record<ThemeMode, ThemeIconName>> = {
  system: "system",
  light: "sun",
  dark: "moon",
};
