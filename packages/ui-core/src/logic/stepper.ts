// @mythicalos/ui-core — PURE, DOM-free wizard-stepper derivation (ds/components-stepper). Ported
// upstream from the product mockups, which hand-rolled the same row four times (two page-level
// steppers with hairline connectors, two card-head dot rows without): numbered circles that walk
// todo → current → done, a label beside each, an optional connector bar between steps.
//
// The done state is the ACCENT family — the accent-soft ✓ with an accent ring — never an `ok`
// recipe: a completed wizard step is progress/selection vocabulary, not a status verdict (token
// rule 2; cf. the session-card spine, whose filled petrol nodes mean "done" the same way).
//
// Clickability rides the ELEMENT, not a class: a binding renders a <button> only for steps the
// caller allows (the pages allow back-nav, i <= current) and a plain <span> otherwise — the same
// grammar as button.my-session-card vs div. This module never decides which steps are clickable.

/** Every class the stepper renders — the bindings import these rather than spelling the strings
 *  themselves, so the two frameworks cannot drift apart on a rename. */
export const STEPPER_PARTS = {
  root: "my-stepper",
  step: "my-stepper__step",
  dot: "my-stepper__dot",
  /** The connector bar. An OPTIONAL element the caller places between steps — the page-level
   *  steppers draw it, the card-head dot rows do not. */
  bar: "my-stepper__bar",
} as const;

/** Step states, in walk order. `todo` is the DEFAULT and emits no modifier — the base rule
 *  already paints it (surface-hover dot, muted ink). */
export const STEP_STATES = ["todo", "current", "done"] as const;
export type StepState = (typeof STEP_STATES)[number];

/** The done badge, per the pages (three of the four variants mark done with it). */
export const STEP_DONE_GLYPH = "✓";

/** Root class: base + the optional `sm` size step (17px dots, the card-head rows). Anything else
 *  — including `undefined` — is the default 20px step. */
export function stepperClass(size?: "sm"): string {
  const base = STEPPER_PARTS.root;
  return size === "sm" ? `${base} ${base}--sm` : base;
}

/** Step class: base + `--current`/`--done`; `todo` (and anything unrecognised) is the bare base,
 *  for the same degrade reason `chipClass` falls back — a modifier with no rule behind it would
 *  paint nothing while claiming a state. */
export function stepClass(state: StepState = "todo"): string {
  const base = STEPPER_PARTS.step;
  return state === "current" || state === "done" ? `${base} ${base}--${state}` : base;
}

/** The dot's text: {@link STEP_DONE_GLYPH} once done, the step's own number otherwise. */
export function stepBadge(n: number, state: StepState): string {
  return state === "done" ? STEP_DONE_GLYPH : String(n);
}

/** State of step `n` given the CURRENT step, both 1-based (the pages' own numbering): earlier
 *  steps are done, later ones todo. Lives here rather than in the bindings so the two frameworks
 *  derive the walk identically — a non-finite `current` marks nothing current and nothing done. */
export function stepState(n: number, current: number): StepState {
  if (n === current) return "current";
  return typeof current === "number" && n < current ? "done" : "todo";
}
