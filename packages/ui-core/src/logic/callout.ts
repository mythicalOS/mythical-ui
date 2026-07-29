// @mythicalos/ui-core — PURE, DOM-free callout derivation (ds/components-callout; mirrors
// tone.ts's bannerClass). Ported upstream from the product mockups: the titled tone BOX — a
// success panel, a titled list box, a help paragraph, guidance with an action row — where the
// banner stays the one-line notice. One anatomy: optional title OR kicker (never both — the
// bindings enforce it), body, optional actions row, and the tiny round `?` opener (`.my-help`)
// that toggles a help callout.
//
// Glyphs follow the banner's tone-glyph map (tone.ts `BANNER_ICON` — every CalloutTone is a
// BannerTone, so the bindings index that map directly rather than this module minting a second
// glyph derivation): the same rule-7 discipline, a status soft never relies on color alone.

/** Callout tones. `accent` is the DEFAULT (the pages' help callouts) and emits no modifier;
 *  `error` is axis-complete with no page site yet; `neutral` is the quiet titled box. */
export const CALLOUT_TONES = ["accent", "ok", "warn", "info", "error", "neutral"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

/** Every class the callout family renders — the bindings import these rather than spelling the
 *  strings themselves, so the two frameworks cannot drift apart on a rename. */
export const CALLOUT_PARTS = {
  root: "my-callout",
  /** The body-lg tone-ink title row (success/guidance panels) — one of title/kicker per callout. */
  title: "my-callout__title",
  /** The micro-uppercase header (titled list boxes) — one of title/kicker per callout. */
  kicker: "my-callout__kicker",
  glyph: "my-callout__glyph",
  body: "my-callout__body",
  acts: "my-callout__acts",
  /** The family's opener: the tiny round `?` that toggles a help callout. */
  help: "my-help",
} as const;

/** The opener's glyph, as every page site draws it. */
export const HELP_GLYPH = "?";
/** The opener's accessible name when the caller supplies none — the pages' own wording. */
export const HELP_LABEL = "What is this?";

function isCalloutTone(tone: unknown): tone is CalloutTone {
  return (CALLOUT_TONES as readonly unknown[]).includes(tone);
}

/** Root class: base + tone modifier (`accent` is the base itself). Unrecognised tones degrade to
 *  the default, for the same reason `chipClass` does — a modifier with no rule behind it would
 *  claim a tone it does not show. */
export function calloutClass(tone: CalloutTone = "accent"): string {
  const base = CALLOUT_PARTS.root;
  return isCalloutTone(tone) && tone !== "accent" ? `${base} ${base}--${tone}` : base;
}

/** Opener class: base + ` is-open`. Only a real `true` opens — the paint must never disagree
 *  with the `aria-expanded` the binding renders beside it. */
export function helpClass(state: { open?: boolean } = {}): string {
  const base = CALLOUT_PARTS.help;
  return state?.open === true ? `${base} is-open` : base;
}
