// @mythicalos/ui-core — the send bar half of the terminal set (ds/components-terminal, spec v2):
// delivery-class selection, draft/keyboard semantics, and the honest per-class hint. Pure — both
// the Preact and React bindings derive every class string and every user-visible string from here,
// so the two bindings (and any future one) cannot drift on the copy that carries the honesty.

/** Delivery class. `asap` takes the first turn gap; `on-done` waits for full idle. */
export type DeliveryClass = "asap" | "on-done";

export const DELIVERY_CLASSES: readonly DeliveryClass[] = ["asap", "on-done"];

/** Verbatim badge/button label for a delivery class. */
export function deliveryClassLabel(cls: DeliveryClass): "ASAP" | "ON-DONE" {
  return cls === "asap" ? "ASAP" : "ON-DONE";
}

/**
 * HONESTY INVARIANT (binding, do not reword): delivery ALWAYS waits for a turn boundary. The design
 * card's older per-class wording — "ASAP interrupts · ON-DONE waits" — is FALSE: nothing about ASAP
 * interrupts a turn in flight, it merely takes the FIRST gap between turns. This one combined line
 * replaces both of the card's per-class hints. Never reintroduce "interrupts" here.
 */
export const DELIVERY_HINT = "ASAP takes the first turn gap · ON-DONE waits for full idle.";

/** Enabled placeholder when the caller supplies no target name. */
export const SEND_PLACEHOLDER = "Message… (⏎ send · ⇧⏎ newline)";

/** Last-resort disabled placeholder when the caller supplies no reason. Says only that sending is
 *  unavailable — it never speculates about why. */
export const SEND_DISABLED_FALLBACK = "Sending is unavailable.";

/**
 * Placeholder copy. Disabled ⇒ the caller's honest reason (or the neutral fallback); enabled ⇒ the
 * design's named prompt `Message {name}… (⏎ send · ⇧⏎ newline)` when a target name is supplied,
 * otherwise the nameless form. A disabled bar NEVER shows the enabled prompt.
 */
export function sendPlaceholder(disabled: boolean, disabledReason?: string, targetName?: string): string {
  if (disabled) return disabledReason ?? SEND_DISABLED_FALLBACK;
  const name = targetName?.trim();
  return name ? `Message ${name}… (⏎ send · ⇧⏎ newline)` : SEND_PLACEHOLDER;
}

/** Send is possible only with non-blank text, when enabled and not mid-send. */
export function canSend(text: string, disabled: boolean, busy: boolean): boolean {
  return !disabled && !busy && text.trim().length > 0;
}

/**
 * The ASAP/ON-DONE semantics line renders ONLY where the delivery controls are actually usable — a
 * disabled bar surfaces just the truthful reason (through the placeholder), never per-class
 * semantics for controls the user cannot operate.
 */
export function showDeliveryHint(disabled: boolean): boolean {
  return !disabled;
}

/**
 * The draft clears ONLY on a delivered/queued success AND only when the field still holds exactly
 * the submitted body — the field stays editable while the request is in flight, so text typed
 * meanwhile is a NEWER draft a completing send must not erase. A failed send keeps the text either
 * way, so the user retries without retyping.
 */
export function clearDraftOnSend(sent: boolean, submitted: string, current: string): boolean {
  return sent === true && submitted === current;
}

/** Textarea key semantics: Enter=send, Shift/Alt-Enter=newline, IME composition suppressed. */
export type KeyAction = "send" | "newline" | "none";

/**
 * HONESTY INVARIANT: an in-progress IME composition NEVER sends — `isComposing` short-circuits to
 * `none` so a CJK/dead-key commit press can't fire a delivery the user did not ask for.
 */
export function keyAction(ev: unknown): KeyAction {
  const e = ev as { key?: unknown; isComposing?: unknown; shiftKey?: unknown; altKey?: unknown } | null;
  if (!e || e.key !== "Enter" || e.isComposing) return "none";
  if (e.shiftKey || e.altKey) return "newline";
  return "send";
}

// ── class derivation ──

/** The send button's label. */
export const SEND_BUTTON_LABEL = "Send";

/**
 * Every structural class the send bar renders. Named here — not typed literally in a binding — so
 * the Preact and React bindings cannot drift.
 *
 * DEVIATION FROM THE DESIGN CARD (deliberate, carried over from the shipped implementation this was
 * extracted from): the card draws the delivery class as a `<select>`. The shipped bar uses a
 * two-button segmented control with `aria-pressed`, because with exactly two mutually exclusive
 * options both are visible at once — the current class is readable without opening a menu, which is
 * what a delivery decision needs. Everything else in the bar follows the card.
 */
export const SENDBAR_CLASSES = {
  wrap: "my-sendbar-wrap",
  segment: "my-sendbar__seg",
  input: "my-sendbar__input",
  send: "my-sendbar__send",
  hint: "my-sendbar__hint",
  notice: "my-sendbar__notice",
} as const;

/** The bar wrapper: `my-sendbar`, plus `is-disabled` when the whole bar is unusable. */
export function sendBarClass(disabled: boolean): string {
  return disabled ? "my-sendbar is-disabled" : "my-sendbar";
}

/** One delivery-class segment button; `is-on` marks the current selection. */
export function deliveryClassButtonClass(selected: boolean): string {
  return selected ? "my-sendbar__cls is-on" : "my-sendbar__cls";
}
