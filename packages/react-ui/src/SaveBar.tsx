// @mythicalos/react-ui — the dirty-state save bar (ds/layouts-settings.html): full-bleed at the
// bottom of the screen, `N unsaved change(s) · <fields>` on the left, Discard + the page's single
// primary on the right.
//
// React twin of packages/preact-ui/src/SaveBar.tsx. The count/plural sentence and separator are
// derived by `@mythicalos/ui-core`'s `saveBarNote`, never rebuilt here. Preact→React prop delta:
// the sibling's passthrough `class` is `className` here (this package's standing convention).
//
// The card's rule "the save bar slides up only when dirty" is owned by the atom: with no changed
// fields it renders nothing, so no surface can show "0 unsaved changes" beside a live Save button.

import type { ReactNode } from "react";
import {
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  SAVE_BAR_PARTS,
  SAVE_BAR_SEP,
  saveBarClass,
  saveBarDirty,
  saveBarNote,
  type SaveBarNote,
} from "@mythicalos/ui-core/logic";
import { Button } from "./Button.js";

export {
  saveBarNote,
  saveBarDirty,
  saveBarClass,
  SAVE_BAR_PARTS,
  SAVE_BAR_SEP,
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  type SaveBarNote,
};

export interface SaveBarProps {
  /** Human labels of the dirty fields. Empty ⇒ the bar does not render. */
  changed: readonly string[];
  /** A save is in flight: the primary goes loading + inert. */
  saving?: boolean;
  /** Card copy is "Save & apply"; override per surface. */
  saveLabel?: string;
  discardLabel?: string;
  onDiscard: () => void;
  onSave: () => void;
  /** Extra content rendered between the note and the actions (e.g. a validation hint). */
  children?: ReactNode;
  className?: string;
}

export function SaveBar(props: SaveBarProps) {
  const { changed, saving = false, className: cls = "" } = props;
  const note = saveBarNote(changed);
  if (note.count === 0) return null;
  return (
    <div className={`${saveBarClass()} ${cls}`}>
      <span className={SAVE_BAR_PARTS.note}>
        <b className={SAVE_BAR_PARTS.count}>{note.countLabel}</b>
        {SAVE_BAR_SEP}
        {note.detail}
      </span>
      {props.children}
      <span className={SAVE_BAR_PARTS.actions}>
        <Button variant="sec" onClick={props.onDiscard}>
          {props.discardLabel ?? SAVE_BAR_DISCARD_LABEL}
        </Button>
        <Button variant="pri" loading={saving} onClick={props.onSave}>
          {props.saveLabel ?? SAVE_BAR_SAVE_LABEL}
        </Button>
      </span>
    </div>
  );
}
