/** @jsxImportSource preact */
// @mythicalos/preact-ui — confirm dialogs (ds/components-dialogs). Modal 400px, radius 16, modal
// shadow over the scrim, Esc = cancel, the safe action focused first. Danger FILL is reserved for
// genuine destructive confirms (book §7.7). The generic, fully prop-driven `ConfirmDialog` (with
// its optional typed-name-match gate — rules-of-use 9) + the exported `Scrim` are the shared
// commons; app-specific wrappers compose them in the app (design note §1b-D21: neutral prop
// names only — no product domain vocabulary leaks from this package).
//
// Ported from the family's internal Preact atoms package (ConfirmDialog.tsx). `typedNameMatches` and
// `BULLET_ICON`/`DialogBullet` were defined locally there — they now live in `@mythicalos/ui-core`
// (Task 2, ported verbatim) so this binding only renders; the typed-name gate decision is a single
// core function call, never re-implemented here.

import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { typedNameMatches, BULLET_ICON, type DialogBullet } from "@mythicalos/ui-core/logic";

export { typedNameMatches, BULLET_ICON, type DialogBullet };

export function Scrim(props: { children: ComponentChildren; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onCancel]);
  return (
    <div class="scrim" role="dialog" aria-modal="true">
      <div class="dlg">{props.children}</div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: string;
  body: ComponentChildren;
  bullets?: DialogBullet[];
  confirmLabel: string;
  cancelLabel?: string;
  /** Typed-name-match gate (rules-of-use 9): when set, the danger action stays disabled until the
   * operator types EXACTLY this string (e.g. the slot name being deleted). */
  requireName?: string;
  /** Overrides the typed-name entry hint ("Type <name> to confirm" by default). */
  requireNameHint?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A destructive confirm — danger FILL, safe action focused first (Esc cancels), with an optional
 * typed-name-match gate for irreversible deletes. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  const nameOk = typedNameMatches(props.requireName, typed);
  const confirmDisabled = props.loading === true || !nameOk;
  return (
    <Scrim onCancel={props.onCancel}>
      <h2>{props.title}</h2>
      <p>{props.body}</p>
      {props.bullets ? (
        <ul>
          {props.bullets.map((b) => (
            <li>
              <i class={`ic-${b.tone}`} aria-hidden="true">
                {BULLET_ICON[b.tone]}
              </i>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {props.requireName !== undefined ? (
        <label class="field">
          <span class="field-label">{props.requireNameHint ?? `Type ${props.requireName} to confirm`}</span>
          <input
            class="input mono"
            type="text"
            value={typed}
            placeholder={props.requireName}
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
          />
        </label>
      ) : null}
      <div class="dlg-foot">
        <button ref={cancelRef} type="button" class="btn btn--sec" onClick={props.onCancel}>
          {props.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="button"
          class={`btn danf${confirmDisabled ? " is-disabled" : ""}`}
          disabled={confirmDisabled}
          aria-busy={props.loading ? "true" : undefined}
          onClick={() => {
            if (!confirmDisabled) props.onConfirm();
          }}
        >
          {props.loading ? <span class="spin" aria-hidden="true" /> : null}
          {props.confirmLabel}
        </button>
      </div>
      <div class="esc">Esc cancels · focus starts on the safe action</div>
    </Scrim>
  );
}
