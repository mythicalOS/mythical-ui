/** @jsxImportSource preact */
// @mythicalos/preact-ui — the dirty-state save bar (ds/layouts-settings.html): full-bleed at the
// bottom of the screen, `N unsaved change(s) · <fields>` on the left, Discard + the page's single
// primary on the right.
//
// Extracted from the reference implementation in the reference product's settings/projects pages.
// Its `changed` was `(keyof MythicalConfig)[]` — a product config key union; here it is plain
// `string[]` field labels. The count/plural sentence and the separator are derived by
// `@mythicalos/ui-core`'s `saveBarNote` — this binding only renders.
//
// The card's rule "the save bar slides up only when dirty" is OWNED by the atom: with no changed
// fields it renders nothing, so no surface can show "0 unsaved changes" beside a live Save button.
// (The animation itself is `.my-savebar`'s, with a prefers-reduced-motion opt-out.)

import type { ComponentChildren } from "preact";
import {
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
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
  /** Card copy is "Save & apply"; override per surface (the reference product says "Save locally"
   *  because its save writes to the local container). */
  saveLabel?: string;
  discardLabel?: string;
  onDiscard: () => void;
  onSave: () => void;
  /** Extra content rendered between the note and the actions (e.g. a validation hint). */
  children?: ComponentChildren;
  class?: string;
}

export function SaveBar(props: SaveBarProps) {
  const { changed, saving = false, class: cls = "" } = props;
  const note = saveBarNote(changed);
  if (note.count === 0) return null;
  return (
    <div class={`${saveBarClass()} ${cls}`}>
      <span class="my-savebar__note">
        <b class="my-savebar__count">{note.countLabel}</b>
        {SAVE_BAR_SEP}
        {note.detail}
      </span>
      {props.children}
      <span class="my-savebar__actions">
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
