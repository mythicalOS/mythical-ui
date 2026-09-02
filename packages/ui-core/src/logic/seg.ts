// @mythicalos/ui-core — PURE, DOM-free tab-segment derivation (ds/components-seg). Ported
// upstream from the product mockups, which hand-rolled the same squared segmented switcher at
// five sites (view lenses, run windows/filters, a metrics window, a terminal/task switcher),
// each carrying a bg/ink/weight triple per option that a single `is-on` class replaces.
//
// This is NOT the theme toggle: that family's pill is a scoped rule-10 exception, and its
// raised-surface knob grammar stays with it. The seg is squared, and selection is the house
// selection grammar — accent-soft fill + accent-strong ink + bold — the same read as a scope
// picker's current row or a send bar's active class segment.
//
// Semantics stay with the bindings: the pages are view switchers and filters, so a binding
// renders role="tablist"/aria-selected (or a radiogroup); class derivation is DOM-free per the
// module idiom.

/** Every class the seg renders — the bindings import these rather than spelling the strings
 *  themselves, so the two frameworks cannot drift apart on a rename. */
export const SEG_PARTS = {
  root: "my-seg",
  opt: "my-seg__opt",
  /** Mono-ish count riding beside an option's label ("failed 3") — tabular digits, rule 5. */
  count: "my-seg__count",
} as const;

/** Root class: base + the optional `grow` stretch (the lens variant fills its row; every other
 *  page site is content-width). Only a real `true` grows. */
export function segClass(opts: { grow?: boolean } = {}): string {
  const base = SEG_PARTS.root;
  return opts?.grow === true ? `${base} ${base}--grow` : base;
}

/** Option class: base + ` is-on` when selected. Only a real `true` selects — a truthy
 *  non-boolean does not claim a selection (same contract as `chipDropdownClass`). */
export function segOptionClass(state: { selected?: boolean } = {}): string {
  const base = SEG_PARTS.opt;
  return state?.selected === true ? `${base} is-on` : base;
}

/** The count slot's text, or `null` when there is no count to show. A count is a real,
 *  non-negative INTEGER — the same contract, and the same reasoning, as `chipCountText`:
 *  `undefined`/`NaN`/`Infinity`/negatives/fractions are malformed data, not a count the caller
 *  measured, and must not render. `0` IS a count and renders. */
export function segCountText(count?: unknown): string | null {
  return typeof count === "number" && Number.isInteger(count) && count >= 0 ? String(count) : null;
}
