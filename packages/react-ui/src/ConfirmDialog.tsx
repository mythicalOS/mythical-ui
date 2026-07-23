// @mythicalos/react-ui — confirm dialogs (ds/components-dialogs). Modal 400px, radius 16, modal
// shadow over the scrim, Esc = cancel, the safe action focused first. Danger FILL is reserved for
// genuine destructive confirms (book §7.7). The generic, fully prop-driven `ConfirmDialog` (with
// its optional typed-name-match gate — rules-of-use 9) + the exported `Scrim` are the shared
// commons; app-specific wrappers compose them in the app (design note §1b-D21: neutral prop
// names only — no product domain vocabulary leaks from this package).
//
// React twin of packages/preact-ui/src/ConfirmDialog.tsx. `typedNameMatches` and
// `BULLET_ICON`/`DialogBullet` are imported (never re-implemented) from `@mythicalos/ui-core`, same
// as the Preact sibling. Two Preact→React deltas: (1) the typed-name `<input>` now attaches
// `onChange` unconditionally (it always has local state behind it, so this is really a no-op
// change); (2) the bullets `<li>` list now carries an explicit `key` — React's dev-mode key
// warning fires at element-creation time (even under `renderToStaticMarkup`), while Preact never
// checks for one, so a bare `.map()` here would print console noise the Preact sibling never has.
// `window`'s native KeyboardEvent below is the DOM global, not React's synthetic type — no `react`
// import shadows it in this file.

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { typedNameMatches, BULLET_ICON, type DialogBullet } from "@mythicalos/ui-core/logic";

export { typedNameMatches, BULLET_ICON, type DialogBullet };

export function Scrim(props: { children: ReactNode; onCancel: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onCancel]);
  return (
    <div className="scrim" role="dialog" aria-modal="true">
      <div className="dlg">{props.children}</div>
    </div>
  );
}

export interface ConfirmDialogProps {
  title: string;
  body: ReactNode;
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
          {props.bullets.map((b, i) => (
            <li key={i}>
              <i className={`ic-${b.tone}`} aria-hidden="true">
                {BULLET_ICON[b.tone]}
              </i>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {props.requireName !== undefined ? (
        <label className="field">
          <span className="field-label">{props.requireNameHint ?? `Type ${props.requireName} to confirm`}</span>
          <input
            className="input mono"
            type="text"
            value={typed}
            placeholder={props.requireName}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      ) : null}
      <div className="dlg-foot">
        <button ref={cancelRef} type="button" className="btn btn--sec" onClick={props.onCancel}>
          {props.cancelLabel ?? "Cancel"}
        </button>
        <button
          type="button"
          className={`btn danf${confirmDisabled ? " is-disabled" : ""}`}
          disabled={confirmDisabled}
          aria-busy={props.loading ? "true" : undefined}
          onClick={() => {
            if (!confirmDisabled) props.onConfirm();
          }}
        >
          {props.loading ? <span className="spin" aria-hidden="true" /> : null}
          {props.confirmLabel}
        </button>
      </div>
      <div className="esc">Esc cancels · focus starts on the safe action</div>
    </Scrim>
  );
}
