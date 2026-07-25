// @mythicalos/ui-core — the dirty-state save bar's pure text composition + class derivation
// (ds/layouts-settings.html: the bar pinned to the bottom of the settings screen —
// `1 unsaved change · Base URL` on the left, Discard + the page's single primary on the right).
//
// Extracted from the reference implementation in the reference product's settings/projects pages,
// which took a `(keyof MythicalConfig)[]` — a product config's key union. That product coupling is
// lifted out here: the atom takes plain `string[]` field labels and composes the same sentence.
//
// The count/plural derivation and the separator live here (not in the bindings) so the Preact and
// React renders can never drift, and so a consumer can assert the exact visible sentence without a
// DOM — the same contract `composeToastText` holds for the toast.

/** The separator between the bold "N unsaved change(s)" count and the changed-field list. */
export const SAVE_BAR_SEP = " · ";

/** Design-card copy for the two actions (ds/layouts-settings.html). Both are overridable per
 *  surface — the reference product's settings page says "Save locally" because its save writes to
 *  the local container, not the card's "Save & apply". */
export const SAVE_BAR_DISCARD_LABEL = "Discard";
export const SAVE_BAR_SAVE_LABEL = "Save & apply";

export interface SaveBarNote {
  /** How many fields are dirty. `0` ⇒ the bar must not be shown at all (see `saveBarDirty`). */
  count: number;
  /** The bold lead-in: `1 unsaved change` / `3 unsaved changes`. */
  countLabel: string;
  /** The changed-field list that follows the separator: `Base URL, Harness`. */
  detail: string;
  /** The full visible sentence, `countLabel + SAVE_BAR_SEP + detail`. Empty `detail` ⇒ just the
   *  count (never a dangling separator). */
  text: string;
}

/** Compose the save bar's note from the list of changed-field labels. Pluralization is decided
 *  here, once, for both bindings. Non-string / blank entries are dropped rather than rendered as
 *  `undefined` in the list — but they are dropped BEFORE the count, so the count always equals the
 *  number of fields actually named. */
export function saveBarNote(changed: readonly string[]): SaveBarNote {
  const fields = (changed ?? []).filter(
    (f): f is string => typeof f === "string" && f.trim().length > 0,
  );
  const count = fields.length;
  const countLabel = `${count} unsaved ${count === 1 ? "change" : "changes"}`;
  const detail = fields.join(", ");
  return {
    count,
    countLabel,
    detail,
    text: detail.length > 0 ? `${countLabel}${SAVE_BAR_SEP}${detail}` : countLabel,
  };
}

/** The card's "the save bar slides up only when dirty" rule, as a predicate. The bindings return
 *  `null` for a not-dirty bar so no surface can ever render "0 unsaved changes" next to a live
 *  Save button. */
export function saveBarDirty(changed: readonly string[]): boolean {
  return saveBarNote(changed).count > 0;
}

/** Root class for the bar. No tone axis — the modifier space is reserved for the caller's own
 *  passthrough class, which the bindings append. */
export function saveBarClass(): string {
  return "my-savebar";
}
