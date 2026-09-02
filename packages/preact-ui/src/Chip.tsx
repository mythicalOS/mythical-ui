/** @jsxImportSource preact */
// @mythicalos/preact-ui — Chip: the canonical NON-interactive label from the design system's Chip
// card (v2). Pill radius + soft fill + no hover, because shape carries the affordance (canonical
// token rule #10) and a pill must never invite a click.
//
// v2 folds the whole badge family into this one atom: eight tones (neutral is the resting default),
// two size steps either side of the default, and three element variants — the tone dot, a mono
// count, and the removable `×`. There is no separate `Tag` atom and no second pill badge.
//
// The single exception to "never clickable" is that `×`: a focusable CHILD with its own focus ring,
// rendered only when `onRemove` is given. The chip itself never becomes a control — no role, no
// tabindex, no click handler. Per the card, a removal target stays ≥24px tall in real UI, so use
// `size="md"` where the chip list is the primary control.
//
// This file is WIRING ONLY: every class string and every piece of copy is derived by
// `@mythicalos/ui-core`, so this binding and its React sibling cannot drift.

import type { ComponentChildren } from "preact";
import {
  CHIP_PARTS,
  CHIP_REMOVE_GLYPH,
  chipClass,
  chipCountText,
  chipRemoveLabel,
  type ChipSize,
  type ChipTone,
} from "@mythicalos/ui-core/logic";

export {
  chipClass,
  chipCountText,
  chipRemoveLabel,
  CHIP_PARTS,
  CHIP_REMOVE_GLYPH,
  CHIP_REMOVE_LABEL,
  CHIP_TONES,
  CHIP_SIZES,
  type ChipTone,
  type ChipSize,
} from "@mythicalos/ui-core/logic";

export interface ChipProps {
  /** Card tones. `neutral` (the default) is the base rule and emits no modifier — a chip at rest
   *  reads as furniture, not as a disabled control. */
  tone?: ChipTone;
  /** `xs` (smaller + tighter) or `md` (roomier, medium weight). Omit for the default step. */
  size?: ChipSize;
  /** Leading tone dot. Decorative — it repeats the tone, it never replaces the word. */
  dot?: boolean;
  /** Mono count beside the label ("records 248"). Only a real, non-negative INTEGER renders;
   *  `undefined`, `NaN`, `Infinity`, a negative and a fraction are all "not a count anyone
   *  measured" and render NOTHING rather than a fabricated figure. `0` IS a count and renders.
   *  The guard is `chipCountText` in the core, so both bindings drop exactly the same values. */
  count?: number;
  /** Renders the removable `×` and receives its click. Omit for a plain chip. */
  onRemove?: () => void;
  /** What is being removed, for the `×`'s accessible name ("Remove <name>"). Without it the
   *  control is announced as the bare "Remove" — never a guessed subject. */
  removeName?: string;
  class?: string;
  /** REQUIRED. The card's do/don't panel bans a colour-only chip outright — "a colour-only chip
   *  says nothing to a screen reader" — and token rule #7 says a soft fill never carries meaning
   *  alone. Every chip on the card pairs its tone with a word (or a dot PLUS a word), so the word
   *  is not optional here, and the type says so. */
  children: ComponentChildren;
}

export function Chip(props: ChipProps) {
  const { tone = "neutral", size, dot = false, count, onRemove, class: cls = "" } = props;
  const countText = chipCountText(count);
  return (
    <span class={`${chipClass(tone, { size })} ${cls}`}>
      {dot ? <span class={CHIP_PARTS.dot} /> : null}
      {props.children}
      {countText !== null ? <span class={CHIP_PARTS.num}>{countText}</span> : null}
      {onRemove ? (
        <button
          type="button"
          class={CHIP_PARTS.remove}
          aria-label={chipRemoveLabel(props.removeName)}
          onClick={() => onRemove()}
        >
          {CHIP_REMOVE_GLYPH}
        </button>
      ) : null}
    </span>
  );
}
