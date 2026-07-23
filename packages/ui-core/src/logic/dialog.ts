// @mythicalos/ui-core — the pure, DOM-free confirm-dialog helpers (ds/components-dialogs). Ported
// verbatim (names + signatures identical) from mythical-skuld's packages/preact-ui/src/ConfirmDialog.tsx.
// The `ConfirmDialog`/`Scrim` renderers stay in the framework bindings; this module keeps only the
// prop-shape types and the typed-name-match gate that drives them.

import type { Tone } from "./tone.js";

export interface DialogBullet {
  tone: Tone;
  text: string;
}

export const BULLET_ICON: Record<DialogBullet["tone"], string> = { ok: "✓", warn: "▲", error: "⬤" };

/** The pure typed-name gate: without a required name the confirm is always enabled; with one,
 * only the exact (whitespace-trimmed, case-sensitive) match enables the danger action. */
export function typedNameMatches(requireName: string | undefined, typed: string): boolean {
  if (requireName === undefined) return true;
  return typed.trim() === requireName;
}
