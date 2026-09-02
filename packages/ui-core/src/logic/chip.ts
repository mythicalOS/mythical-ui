// @mythicalos/ui-core — the CHIP family: class derivation, parts and copy for the design system's
// "Chip — tones, sizes & variants" card (v2). One family, three jobs, and the SHAPE carries the
// affordance so a user never has to guess whether a label is a button:
//
//   Chip          pill (--my-r-pill), soft fill, no hover — a human label that is NEVER clickable.
//                 The one exception is the removable `×`, which is a focusable CHILD of the chip,
//                 not a clickable chip (see CHIP_PARTS.remove).
//   ChipFlag      squared, mono, uppercase — machine facts (kinds, git counters, diff letters).
//   ChipDropdown  the ONLY interactive member: control radius (--my-r-control), the control
//                 border, and a hover invite.
//
// That split is canonical token rule #10 ("--my-r-pill is for NON-interactive status tags/labels
// only; everything clickable is squared --my-r-control"), so it is a design invariant, not a
// preference — an interactive control must never look like a pill.
//
// SUPERSESSION (v2 card). An earlier revision of the card shipped this family under a second name,
// `Tag`, alongside the older `Chip` atom — two pill badges with soft tone fills and no rule for
// which to reach for. The v2 card retires that split: `Chip` absorbs the family and there is no
// `Tag` concept. This module is the single home of the whole family, INCLUDING `chipClass`;
// a second derivation of a chip's class string is exactly the drift
// this consolidation exists to prevent, so there is only ever one.
//
// Naming: the card's CSS shorthand for the error tone is `err`; this package's tone vocabulary
// says `error` everywhere (`statusLineClass`, `bannerClass`, `gitFlagClass`'s
// `my-gitchip__flag--error`). The house word wins, so both the type and the emitted modifier are
// `error`. There is no `err` anywhere in this package.

// ── Chip ───────────────────────────────────────────────────────────────────────────────────────

/** Chip tones, in card order. `neutral` is the DEFAULT and emits no modifier — the base rule
 *  already paints it (--my-surface-hover fill, --my-muted ink: a chip at rest reads as furniture,
 *  not as a disabled control). */
export const CHIP_TONES = [
  "neutral",
  "accent",
  "ok",
  "warn",
  "error",
  "info",
  "outline",
  "empty",
] as const;
export type ChipTone = (typeof CHIP_TONES)[number];

/** Size steps ABOVE and BELOW the default. Omitting `size` is the card's unnamed default step. */
export const CHIP_SIZES = ["xs", "md"] as const;
export type ChipSize = (typeof CHIP_SIZES)[number];

/** Every class the chip renders, root and elements — the bindings import these rather than spelling
 *  the strings themselves, so the two frameworks cannot drift apart on a rename. */
export const CHIP_PARTS = {
  root: "my-chip",
  /** Leading tone dot. Decorative: it repeats the tone, it never replaces the word (token rule
   *  #7 — a soft fill never carries meaning alone). */
  dot: "my-chip__dot",
  /** Mono count riding beside the label ("records 248"). */
  num: "my-chip__num",
  /** The removable `×`. The ONE thing inside a chip that may be clicked, and it carries its own
   *  focus ring — the chip itself stays non-interactive. */
  remove: "my-chip__x",
} as const;

/** The removal glyph, per the card. */
export const CHIP_REMOVE_GLYPH = "×";
/** Accessible name for a removal control whose subject was not named. Deliberately says only what
 *  is certain — the caller supplies the subject to get the card's "Remove <name>". */
export const CHIP_REMOVE_LABEL = "Remove";

export interface ChipState {
  /** `xs` or `md`; anything else — including `undefined` — is the default step. */
  size?: ChipSize;
}

function isChipTone(tone: unknown): tone is ChipTone {
  return (CHIP_TONES as readonly unknown[]).includes(tone);
}

function isChipSize(size: unknown): size is ChipSize {
  return (CHIP_SIZES as readonly unknown[]).includes(size);
}

/** Root class: base + tone modifier (`neutral` is the base itself) + optional size modifier.
 *
 *  An unrecognised tone or size — reachable from a JS consumer, or from a product that still
 *  passes the card's `err` shorthand — degrades to the DEFAULT rather than emitting a modifier
 *  with no rule behind it. A `my-chip--err` class would silently paint nothing, leaving a chip
 *  that claims a status it does not show; falling back keeps the label readable and un-toned. */
export function chipClass(tone: ChipTone = "neutral", state: ChipState = {}): string {
  const base = CHIP_PARTS.root;
  let cls = isChipTone(tone) && tone !== "neutral" ? `${base} ${base}--${tone}` : base;
  const size = state?.size;
  if (isChipSize(size)) cls += ` ${base}--${size}`;
  return cls;
}

/** The count slot's text, or `null` when there is no count to show.
 *
 *  A count is a real, non-negative INTEGER. `undefined` (not reported), `NaN`, `Infinity`,
 *  negatives and fractions are all "not a count" — a fraction cannot be a number of records and a
 *  negative cannot be a number of anything, so they are malformed data and must not be rendered as
 *  a count the caller never measured. `0` IS a count and renders. Same contract, and the same
 *  reasoning, as `gitFlags`'s internal `isCount`. */
export function chipCountText(count?: unknown): string | null {
  return typeof count === "number" && Number.isInteger(count) && count >= 0 ? String(count) : null;
}

/** The removal control's accessible name: the card's "Remove <name>" when the subject is known,
 *  the bare {@link CHIP_REMOVE_LABEL} when it is not. Never invents a subject. */
export function chipRemoveLabel(name?: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length > 0 ? `${CHIP_REMOVE_LABEL} ${trimmed}` : CHIP_REMOVE_LABEL;
}

// ── ChipFlag ───────────────────────────────────────────────────────────────────────────────────

/** Chip-flag tones, in card order. `accent` is the DEFAULT and emits no modifier. Flags are honest
 *  counters, never decoration: warn-soft for behind/uncommitted, error-soft ONLY for something
 *  that can be lost, ok-soft for a clean tree. `info` is its own tone, not a `neutral`: "a machine
 *  fact that is merely informational is a `neutral`" is not the distinction the product mockups
 *  actually draw — they render info-MEANING facts (a
 *  review pass, an on-done delivery class, an observation kind) side-by-side with genuinely
 *  neutral ones (boot, reference, dim) in the same row, and collapsing both onto neutral loses a
 *  distinction the pages depend on. `neutral` remains the arm for facts with no status meaning
 *  at all. */
export const CHIP_FLAG_TONES = ["accent", "ok", "warn", "error", "neutral", "info"] as const;
export type ChipFlagTone = (typeof CHIP_FLAG_TONES)[number];

export const CHIP_FLAG_PARTS = {
  root: "my-chip-flag",
} as const;

function isChipFlagTone(tone: unknown): tone is ChipFlagTone {
  return (CHIP_FLAG_TONES as readonly unknown[]).includes(tone);
}

/** Root class: base + tone modifier (`accent` is the base itself). Unrecognised tones degrade to
 *  the default, for the same reason `chipClass` does. */
export function chipFlagClass(tone: ChipFlagTone = "accent"): string {
  const base = CHIP_FLAG_PARTS.root;
  return isChipFlagTone(tone) && tone !== "accent" ? `${base} ${base}--${tone}` : base;
}

// ── ChipDropdown ───────────────────────────────────────────────────────────────────────────────

// The static prefix ("model", "tier") is a bare text node, exactly as on the card — it takes the
// control's own ink and needs no element of its own. (The popover trigger DOES wrap its label, but
// only because that card mutes it; this one does not.)
export const CHIP_DROPDOWN_PARTS = {
  root: "my-chip-dd",
  /** The current value — the card's `<b>`, emphasised with --my-fw-medium. */
  value: "my-chip-dd__value",
  /** The dropdown caret. Decorative — it duplicates the control's own affordance. */
  caret: "my-chip-dd__caret",
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

/** The minimum an activation event has to offer for the gate below to do its job. Both bindings'
 *  click events satisfy it (Preact's native event, React's synthetic one). */
export interface ChipDropdownActivation {
  preventDefault(): void;
  stopPropagation(): void;
}

/** Activation gate. Returns `true` when the caller's `onClick` should run.
 *
 *  A disabled chip is announced with `aria-disabled` and therefore stays FOCUSABLE — which means
 *  the platform still dispatches a real click on pointer or keyboard activation. Simply not
 *  attaching the component's own handler is not enough: that click still BUBBLES, so a disabled
 *  chip sitting inside a clickable row would activate the row. "Disabled" has to stop the event,
 *  not just decline it. Both bindings route through here, so neither can lose the suppression. */
export function chipDropdownActivate(
  event: ChipDropdownActivation,
  state: { disabled?: boolean } = {},
): boolean {
  if (state?.disabled !== true) return true;
  if (typeof event?.preventDefault === "function") event.preventDefault();
  if (typeof event?.stopPropagation === "function") event.stopPropagation();
  return false;
}
