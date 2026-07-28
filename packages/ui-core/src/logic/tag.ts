// @mythicalos/ui-core — the tags & chips family: class derivation, parts and copy for the design
// system's "Tags & chips" card. One family, three jobs, and the SHAPE carries the affordance so a
// user never has to guess whether a label is a button:
//
//   Tag           pill (--my-r-pill), soft fill, no hover — a human label that is NEVER clickable.
//                 The one exception is the removable `×`, which is a focusable CHILD of the tag,
//                 not a clickable tag (see TAG_PARTS.remove).
//   Flag          squared, mono, uppercase — machine facts (kinds, git counters, diff letters).
//   ChipDropdown  the ONLY interactive member: control radius (--my-r-control), the control
//                 border, and a hover invite.
//
// That split is canonical token rule #10 ("--my-r-pill is for NON-interactive status tags/labels
// only; everything clickable is squared --my-r-control"), so it is a design invariant, not a
// preference — an interactive control must never look like a pill.
//
// Naming: the card's CSS shorthand for the error tone is `err`; this package's tone vocabulary
// says `error` everywhere (`chipClass`'s `my-chip--error`, `gitFlagClass`'s
// `my-gitchip__flag--error`, `statusLineClass`, `bannerClass`). The house word wins, so both the
// type and the emitted modifier are `error`. There is no `err` anywhere in this package.
//
// FUTURE MAINTAINER DECISION, deliberately NOT made here: `Tag` and the older `Chip` atom overlap
// — both are pill badges with soft tone fills. Whether `Tag` supersedes `Chip` (and on what
// deprecation path), or whether the two keep separate jobs, is a maintainer call. Nothing in this
// file changes, deprecates or re-points `chipClass`/`Chip`; this family is purely additive.

// ── Tag ────────────────────────────────────────────────────────────────────────────────────────

/** Tag tones, in card order. `accent` is the DEFAULT and emits no modifier (the base rule already
 *  paints it), exactly as `chipClass`'s `neutral` does. */
export const TAG_TONES = [
  "accent",
  "ok",
  "warn",
  "error",
  "info",
  "neutral",
  "outline",
  "empty",
] as const;
export type TagTone = (typeof TAG_TONES)[number];

/** Size steps ABOVE and BELOW the default. Omitting `size` is the card's unnamed default step. */
export const TAG_SIZES = ["xs", "md"] as const;
export type TagSize = (typeof TAG_SIZES)[number];

/** Every class the tag renders, root and elements — the bindings import these rather than spelling
 *  the strings themselves, so the two frameworks cannot drift apart on a rename. */
export const TAG_PARTS = {
  root: "my-tag",
  /** Leading tone dot. Decorative: it repeats the tone, it never replaces the word (token rule
   *  #7 — a soft fill never carries meaning alone). */
  dot: "my-tag__dot",
  /** Mono count riding beside the label ("records 248"). */
  num: "my-tag__num",
  /** The removable `×`. The ONE thing inside a tag that may be clicked, and it carries its own
   *  focus ring — the tag itself stays non-interactive. */
  remove: "my-tag__x",
} as const;

/** The removal glyph, per the card. */
export const TAG_REMOVE_GLYPH = "×";
/** Accessible name for a removal control whose subject was not named. Deliberately says only what
 *  is certain — the caller supplies the subject to get the card's "Remove <name>". */
export const TAG_REMOVE_LABEL = "Remove";

export interface TagState {
  /** `xs` or `md`; anything else — including `undefined` — is the default step. */
  size?: TagSize;
}

function isTagTone(tone: unknown): tone is TagTone {
  return (TAG_TONES as readonly unknown[]).includes(tone);
}

function isTagSize(size: unknown): size is TagSize {
  return (TAG_SIZES as readonly unknown[]).includes(size);
}

/** Root class: base + tone modifier (`accent` is the base itself) + optional size modifier.
 *
 *  An unrecognised tone or size — reachable from a JS consumer, or from a product that still
 *  passes the card's `err` shorthand — degrades to the DEFAULT rather than emitting a modifier
 *  with no rule behind it. A `my-tag--err` class would silently paint nothing, leaving a tag that
 *  claims a status it does not show; falling back keeps the label readable and un-toned. */
export function tagClass(tone: TagTone = "accent", state: TagState = {}): string {
  const base = TAG_PARTS.root;
  let cls = isTagTone(tone) && tone !== "accent" ? `${base} ${base}--${tone}` : base;
  const size = state?.size;
  if (isTagSize(size)) cls += ` ${base}--${size}`;
  return cls;
}

/** The removal control's accessible name: the card's "Remove <name>" when the subject is known,
 *  the bare {@link TAG_REMOVE_LABEL} when it is not. Never invents a subject. */
export function tagRemoveLabel(name?: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length > 0 ? `${TAG_REMOVE_LABEL} ${trimmed}` : TAG_REMOVE_LABEL;
}

// ── Flag ───────────────────────────────────────────────────────────────────────────────────────

/** Flag tones, in card order. `accent` is the DEFAULT and emits no modifier. Flags are honest
 *  counters, never decoration: warn-soft for behind/uncommitted, error-soft ONLY for something
 *  that can be lost, ok-soft for a clean tree. There is no `info` flag — the card does not have
 *  one, and a machine fact that is merely informational is a `neutral`. */
export const FLAG_TONES = ["accent", "ok", "warn", "error", "neutral"] as const;
export type FlagTone = (typeof FLAG_TONES)[number];

export const FLAG_PARTS = {
  root: "my-flag",
} as const;

function isFlagTone(tone: unknown): tone is FlagTone {
  return (FLAG_TONES as readonly unknown[]).includes(tone);
}

/** Root class: base + tone modifier (`accent` is the base itself). Unrecognised tones degrade to
 *  the default, for the same reason `tagClass` does. */
export function flagClass(tone: FlagTone = "accent"): string {
  const base = FLAG_PARTS.root;
  return isFlagTone(tone) && tone !== "accent" ? `${base} ${base}--${tone}` : base;
}

// ── ChipDropdown ───────────────────────────────────────────────────────────────────────────────

// The static prefix ("model", "tier") is a bare text node, exactly as on the card — it takes the
// control's own ink and needs no element of its own. (The popover trigger DOES wrap its label, but
// only because that card mutes it; this one does not.)
export const CHIP_DROPDOWN_PARTS = {
  root: "my-chipdd",
  /** The current value — the card's `<b>`, emphasised with --my-fw-medium. */
  value: "my-chipdd__value",
  /** The dropdown caret. Decorative — it duplicates the control's own affordance. */
  caret: "my-chipdd__caret",
} as const;

/** The caret glyph, per the card. */
export const CHIP_DROPDOWN_CARET = "▾";
/** Shown when there is no current value. An em dash asserts nothing; a blank slot next to a
 *  confident-looking control reads as a value that failed to load. */
export const CHIP_DROPDOWN_EMPTY_VALUE = "—";

export interface ChipDropdownState {
  /** The card's `.sel` — this chip carries the current selection. */
  selected?: boolean;
}

/** Root class: base + the selected modifier. Disabled is NOT a class: it rides on the element's
 *  own disabled semantics (`aria-disabled="true"`, or a native `disabled` on a <button>), which
 *  the stylesheet targets directly. That keeps the disabled state impossible to paint without
 *  also announcing it to assistive technology. */
export function chipDropdownClass(state: ChipDropdownState = {}): string {
  const base = CHIP_DROPDOWN_PARTS.root;
  return state?.selected === true ? `${base} ${base}--sel` : base;
}

/** The value slot's text: the caller's value, or the honest {@link CHIP_DROPDOWN_EMPTY_VALUE} when
 *  there is none. A blank/whitespace-only value is the same "nothing to show" as `undefined`. */
export function chipDropdownValueText(value?: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : CHIP_DROPDOWN_EMPTY_VALUE;
}
