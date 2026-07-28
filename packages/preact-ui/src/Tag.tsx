/** @jsxImportSource preact */
// @mythicalos/preact-ui — Tag: the canonical NON-interactive label from the design system's
// "Tags & chips" card. Pill radius + soft fill + no hover, because shape carries the affordance
// (canonical token rule #10) and a pill must never invite a click.
//
// The single exception is the removable `×`: a focusable CHILD with its own focus ring, rendered
// only when `onRemove` is given. The tag itself never becomes a control — no role, no tabindex, no
// click handler. Per the card, a removal target stays ≥24px tall in real UI, so use `size="md"`
// where the tag list is the primary control.
//
// This file is WIRING ONLY: every class string and every piece of copy is derived by
// `@mythicalos/ui-core`, so this binding and its React sibling cannot drift.
//
// FUTURE MAINTAINER DECISION, deliberately not made here: `Tag` and the older `Chip` overlap (both
// are pill badges with soft tone fills). Whether Tag supersedes Chip, and on what deprecation
// path, is a maintainer call — this component changes nothing about `Chip`.

import type { ComponentChildren } from "preact";
import {
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  tagClass,
  tagCountText,
  tagRemoveLabel,
  type TagSize,
  type TagTone,
} from "@mythicalos/ui-core/logic";

export {
  tagClass,
  tagCountText,
  tagRemoveLabel,
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  TAG_REMOVE_LABEL,
  TAG_TONES,
  TAG_SIZES,
  type TagTone,
  type TagSize,
} from "@mythicalos/ui-core/logic";

export interface TagProps {
  /** Card tones. `accent` (the default) is the base rule and emits no modifier. */
  tone?: TagTone;
  /** `xs` (tighter) or `md` (roomier, medium weight). Omit for the default step. */
  size?: TagSize;
  /** Leading tone dot. Decorative — it repeats the tone, it never replaces the word. */
  dot?: boolean;
  /** Mono count beside the label ("records 248"). Only a real, non-negative INTEGER renders;
   *  `undefined`, `NaN`, `Infinity`, a negative and a fraction are all "not a count anyone
   *  measured" and render NOTHING rather than a fabricated figure. `0` IS a count and renders.
   *  The guard is `tagCountText` in the core, so both bindings drop exactly the same values. */
  count?: number;
  /** Renders the removable `×` and receives its click. Omit for a plain tag. */
  onRemove?: () => void;
  /** What is being removed, for the `×`'s accessible name ("Remove <name>"). Without it the
   *  control is announced as the bare "Remove" — never a guessed subject. */
  removeName?: string;
  class?: string;
  children?: ComponentChildren;
}

export function Tag(props: TagProps) {
  const { tone = "accent", size, dot = false, count, onRemove, class: cls = "" } = props;
  const countText = tagCountText(count);
  return (
    <span class={`${tagClass(tone, { size })} ${cls}`}>
      {dot ? <span class={TAG_PARTS.dot} /> : null}
      {props.children}
      {countText !== null ? <span class={TAG_PARTS.num}>{countText}</span> : null}
      {onRemove ? (
        <button
          type="button"
          class={TAG_PARTS.remove}
          aria-label={tagRemoveLabel(props.removeName)}
          onClick={() => onRemove()}
        >
          {TAG_REMOVE_GLYPH}
        </button>
      ) : null}
    </span>
  );
}
