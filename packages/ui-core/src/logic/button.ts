// @mythicalos/ui-core — PURE, DOM-free button-class derivation (design book ds/components-buttons).
// Ported verbatim (name + signature identical) from the family's internal Preact atoms package (derive.ts)
// so the Preact and React bindings both derive the same class string from one source.

/** `tone-line` (ported upstream from the product mockups) is the outline mirror of `tone`: the
 * same `data-tone` axis, drawn as the `.btn--dan` recipe per tone — surface fill, tone border,
 * tone ink, tone-soft hover. Its `data-tone="error"` arm is EQUIVALENT to `.btn--dan`, which
 * remains the standing danger-outline contract; the arm ships anyway so the axis is uniform. */
export type BtnVariant = "pri" | "acc" | "sec" | "gho" | "dan" | "tone" | "tone-line";

/** Status tone for the `tone` and `tone-line` variants — rendered as a `data-tone` attribute next
 * to the class string (the CSS keys `.btn--tone[data-tone=…]` / `.btn--tone-line[data-tone=…]`).
 * "accent" (or omitting the attribute) falls through to `.btn--acc` behaviour on the fill and to
 * an accent outline on the line. `error` fills stay governed by design rule 9: lifecycle
 * confirm flows only. */
export type BtnTone = "accent" | "ok" | "warn" | "error" | "info";

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
