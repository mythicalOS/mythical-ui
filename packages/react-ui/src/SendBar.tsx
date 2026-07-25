// @mythicalos/react-ui — the delivery send bar (ds/components-terminal, spec v2). React twin of
// packages/preact-ui/src/SendBar.tsx. Holds the LOCAL draft + class selection and fires
// `onSend(cls, body)`; the caller owns the delivery call.
//
// Thin binding: render + wiring only. The placeholder composition, the send predicate, the
// draft-clear rule, the keyboard semantics and the hint all come from `@mythicalos/ui-core`.
//
// Honesty (binding, inherited from ui-core): the per-class hint is
// `ASAP takes the first turn gap · ON-DONE waits for full idle.` — the design card's older
// "ASAP interrupts" wording is FALSE (delivery always waits for a turn boundary) and must never be
// reintroduced. The hint renders ONLY where the controls are usable; a disabled bar surfaces just
// the caller's truthful reason.
//
// Keyboard: Enter=send, Shift/Alt-Enter=newline, IME composition suppressed (`keyAction`).

import { useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  SENDBAR_CLASSES,
  SEND_BUTTON_LABEL,
  canSend,
  clearDraftOnSend,
  deliveryClassButtonClass,
  deliveryClassLabel,
  keyAction,
  sendBarClass,
  sendPlaceholder,
  showDeliveryHint,
  type DeliveryClass,
} from "@mythicalos/ui-core/logic";

export {
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  SEND_DISABLED_FALLBACK,
  SEND_PLACEHOLDER,
  canSend,
  clearDraftOnSend,
  deliveryClassLabel,
  keyAction,
  sendPlaceholder,
  showDeliveryHint,
  type DeliveryClass,
  type KeyAction,
} from "@mythicalos/ui-core/logic";

export interface SendBarProps {
  /** Initial selection. A manual pick then wins — a later prop change never clobbers it. */
  defaultClass?: DeliveryClass;
  /** A send is in flight: the send button is inert but the field stays editable. */
  busy?: boolean;
  disabled?: boolean;
  /** The honest reason the bar is unusable — surfaced as the placeholder. */
  disabledReason?: string;
  /** A persistent notice rendered below the bar (e.g. a pending stop). */
  notice?: string;
  /** Carried into the enabled placeholder: `Message {name}… (⏎ send · ⇧⏎ newline)`. */
  targetName?: string;
  /** Resolve `true` on success; the draft clears only then (text survives failures). */
  onSend(cls: DeliveryClass, body: string): boolean | Promise<boolean>;
}

export function SendBar(props: SendBarProps) {
  const disabled = !!props.disabled;
  const busy = !!props.busy;
  const [cls, setCls] = useState<DeliveryClass>(props.defaultClass ?? "asap");
  const [text, setText] = useState("");

  const doSend = async () => {
    if (!canSend(text, disabled, busy)) return;
    const submitted = text;
    const sent = await props.onSend(cls, submitted);
    // Functional update: compared against the LIVE draft at resolve time, not this closure's
    // snapshot, so text typed while the request was in flight is never erased.
    if (sent) setText((current) => (clearDraftOnSend(sent, submitted, current) ? "" : current));
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (keyAction(e) === "send") {
      e.preventDefault();
      void doSend();
    }
    // "newline" / "none": the textarea handles the keystroke natively.
  };

  return (
    <div className={SENDBAR_CLASSES.wrap}>
      <div className={sendBarClass(disabled)}>
        <div className={SENDBAR_CLASSES.segment} role="group">
          {DELIVERY_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              className={deliveryClassButtonClass(cls === c)}
              disabled={disabled}
              aria-pressed={cls === c}
              onClick={() => setCls(c)}
            >
              {deliveryClassLabel(c)}
            </button>
          ))}
        </div>
        <textarea
          className={SENDBAR_CLASSES.input}
          rows={1}
          placeholder={sendPlaceholder(disabled, props.disabledReason, props.targetName)}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className={SENDBAR_CLASSES.send}
          disabled={!canSend(text, disabled, busy)}
          onClick={doSend}
        >
          {SEND_BUTTON_LABEL}
        </button>
      </div>
      {showDeliveryHint(disabled) ? <div className={SENDBAR_CLASSES.hint}>{DELIVERY_HINT}</div> : null}
      {props.notice ? <div className={SENDBAR_CLASSES.notice}>{props.notice}</div> : null}
    </div>
  );
}
