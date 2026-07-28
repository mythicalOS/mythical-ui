// @mythicalos/react-ui — Tag: the canonical NON-interactive label from the design system's
// "Tags & chips" card. React twin of packages/preact-ui/src/Tag.tsx — same core functions, same
// markup, so the two bindings cannot drift.
//
// Pill radius + soft fill + no hover, because shape carries the affordance (canonical token
// rule #10). The single exception is the removable `×`: a focusable CHILD with its own focus ring,
// rendered only when `onRemove` is given. Per the card, a removal target stays ≥24px tall in real
// UI, so use `size="md"` where the tag list is the primary control.
//
// Preact→React prop delta (the package's one standing public-API rename): the Preact sibling's
// passthrough class prop is `class`; here it is `className`.
//
// FUTURE MAINTAINER DECISION, deliberately not made here: `Tag` and the older `Chip` overlap (both
// are pill badges with soft tone fills). Whether Tag supersedes Chip, and on what deprecation
// path, is a maintainer call — this component changes nothing about `Chip`.

import type { ReactNode } from "react";
import {
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  tagClass,
  tagRemoveLabel,
  type TagSize,
  type TagTone,
} from "@mythicalos/ui-core/logic";

export {
  tagClass,
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
  /** Mono count beside the label ("records 248"). A non-number — including `undefined`, `NaN` and
   *  `Infinity`, none of which is a count anyone measured — renders NOTHING rather than a
   *  fabricated figure. `0` is a real reported count and DOES render. */
  count?: number;
  /** Renders the removable `×` and receives its click. Omit for a plain tag. */
  onRemove?: () => void;
  /** What is being removed, for the `×`'s accessible name ("Remove <name>"). Without it the
   *  control is announced as the bare "Remove" — never a guessed subject. */
  removeName?: string;
  className?: string;
  children?: ReactNode;
}

export function Tag(props: TagProps) {
  const { tone = "accent", size, dot = false, count, onRemove, className: cls = "" } = props;
  const hasCount = typeof count === "number" && Number.isFinite(count);
  return (
    <span className={`${tagClass(tone, { size })} ${cls}`}>
      {dot ? <span className={TAG_PARTS.dot} /> : null}
      {props.children}
      {hasCount ? <span className={TAG_PARTS.num}>{count}</span> : null}
      {onRemove ? (
        <button
          type="button"
          className={TAG_PARTS.remove}
          aria-label={tagRemoveLabel(props.removeName)}
          onClick={() => onRemove()}
        >
          {TAG_REMOVE_GLYPH}
        </button>
      ) : null}
    </span>
  );
}
