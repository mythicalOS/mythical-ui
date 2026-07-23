// @mythicalos/ui-core — PURE, DOM-free button-class derivation (design book ds/components-buttons).
// Ported verbatim (name + signature identical) from the family's internal Preact atoms package (derive.ts)
// so the Preact and React bindings both derive the same class string from one source.

export type BtnVariant = "pri" | "acc" | "sec" | "gho" | "dan";

export interface BtnState {
  loading?: boolean;
  disabled?: boolean;
  /** Accepted for source-parity with the internal origin surface; currently a no-op — no `.btn--block` selector ships. */
  block?: boolean;
  small?: boolean;
}

/** Compose the button class list (ds/components-buttons). Loading implies inert (disabled). */
export function buttonClass(variant: BtnVariant, s: BtnState = {}): string {
  const cls = ["btn", `btn--${variant}`];
  if (s.small) cls.push("btn--sm");
  if (s.disabled || s.loading) cls.push("is-disabled");
  return cls.join(" ");
}
