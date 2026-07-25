/** @jsxImportSource preact */
// @mythicalos/preact-ui — the delivery send bar (ds/components-terminal, spec v2). Holds the LOCAL
// draft + class selection and fires `onSend(cls, body)`; the caller owns the delivery call.
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

import { useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import {
  DEFAULT_DELIVERY_CLASS,
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  SENDBAR_CLASSES,
  SEND_BUTTON_LABEL,
  canSend,
  clearDraftOnSend,
  deliveryClassButtonClass,
  deliveryClassLabel,
  keyAction,
  makeSendGate,
  resolveSend,
  sendBarClass,
  sendPlaceholder,
  showDeliveryHint,
  type DeliveryClass,
} from "@mythicalos/ui-core/logic";

export {
  DEFAULT_DELIVERY_CLASS,
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  SEND_DISABLED_FALLBACK,
  SEND_PLACEHOLDER,
  canSend,
  clearDraftOnSend,
  deliveryClassLabel,
  keyAction,
  resolveSend,
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
  /**
   * Called when `onSend` REJECTS. The rejection is treated as a failed send (nothing delivered, the
   * draft kept) rather than escaping as an unhandled rejection; this is how a caller still observes
   * it. Omitting it does not hide a success — only a resolved `true` ever counts as sent.
   */
  onSendError?(error: unknown): void;
}

export function SendBar(props: SendBarProps) {
  const disabled = !!props.disabled;
  const busy = !!props.busy;
  const [cls, setCls] = useState<DeliveryClass>(props.defaultClass ?? DEFAULT_DELIVERY_CLASS);
  const [text, setText] = useState("");
  // Single-flight: `busy` covers a caller that tracks the request itself, but `onSend` may be async
  // and a caller that flips `busy` a tick later (or never) would let two clicks — or a click racing
  // an Enter — deliver the same message twice. The gate is synchronous, so the second attempt is
  // refused before any state update lands; `sending` only exists to re-render the disabled button.
  const gate = useRef(makeSendGate());
  const [sending, setSending] = useState(false);
  const locked = busy || sending;

  const doSend = async () => {
    if (!canSend(text, disabled, locked)) return;
    if (!gate.current.tryAcquire()) return;
    setSending(true);
    const submitted = text;
    try {
      // a REJECTED onSend resolves to `false` here (a failed send) instead of escaping the handler
      // as an unhandled rejection; the caller still sees it through `onSendError`
      const sent = await resolveSend(() => props.onSend(cls, submitted), props.onSendError);
      // Functional update: compared against the LIVE draft at resolve time, not this closure's
      // snapshot, so text typed while the request was in flight is never erased.
      if (sent) setText((current) => (clearDraftOnSend(sent, submitted, current) ? "" : current));
    } finally {
      // released on every path, so a failing send can never wedge the bar shut. The draft survives
      // either way (it clears only on `sent === true`).
      gate.current.release();
      setSending(false);
    }
  };

  const onKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (keyAction(e) === "send") {
      e.preventDefault();
      void doSend();
    }
    // "newline" / "none": the textarea handles the keystroke natively.
  };

  return (
    <div class={SENDBAR_CLASSES.wrap}>
      <div class={sendBarClass(disabled)}>
        <div class={SENDBAR_CLASSES.segment} role="group">
          {DELIVERY_CLASSES.map((c) => (
            <button
              key={c}
              type="button"
              class={deliveryClassButtonClass(cls === c)}
              disabled={disabled}
              aria-pressed={cls === c}
              onClick={() => setCls(c)}
            >
              {deliveryClassLabel(c)}
            </button>
          ))}
        </div>
        <textarea
          class={SENDBAR_CLASSES.input}
          rows={1}
          placeholder={sendPlaceholder(disabled, props.disabledReason, props.targetName)}
          value={text}
          disabled={disabled}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          class={SENDBAR_CLASSES.send}
          disabled={!canSend(text, disabled, locked)}
          onClick={doSend}
        >
          {SEND_BUTTON_LABEL}
        </button>
      </div>
      {showDeliveryHint(disabled) ? <div class={SENDBAR_CLASSES.hint}>{DELIVERY_HINT}</div> : null}
      {props.notice ? <div class={SENDBAR_CLASSES.notice}>{props.notice}</div> : null}
    </div>
  );
}
