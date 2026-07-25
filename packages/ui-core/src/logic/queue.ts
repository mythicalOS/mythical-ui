// @mythicalos/ui-core — the queue-row half of the terminal set (ds/components-terminal, spec v2):
// the delivery queue's source→view resolution, row classes, and the two-step inline-cancel state
// machine. Pure — no framework, no DOM. The honesty rules below live HERE, not in the product, so
// every consumer inherits them.

import type { DeliveryClass } from "./sendbar.js";
import { deliveryClassLabel } from "./sendbar.js";

/** Queue record lifecycle. `queued` is the ONLY cancellable state (see `canCancelRow`). */
export type QueueItemStatus = "queued" | "leased" | "delivered" | "canceled";

/** One queue record, generic over the product: an opaque id, its class, its body, its status. */
export interface QueueItem {
  id: string;
  cls: DeliveryClass;
  body: string;
  status: QueueItemStatus;
}

/**
 * Why the queue cannot be shown. These stay DISTINCT on purpose (see `QUEUE_UNAVAILABLE_COPY`):
 * collapsing them into one message would make the UI claim something it does not know.
 *  - `unsupported`  — this deployment does not do queued delivery at all.
 *  - `error`        — the read failed. Says only that; never that the queue is empty.
 *  - `unaddressable` — there is no queue address to read for this target.
 */
export type QueueUnavailableReason = "unsupported" | "error" | "unaddressable";

/**
 * HONESTY INVARIANT (binding, do not reword): CAPABILITY-NEUTRAL empty copy. It reports what the
 * READ returned and nothing else. It must never claim operational emptiness ("queue empty", "no
 * pending deliveries"), never imply a store exists, and never restate the design card's
 * "deliveries land here by class (ASAP interrupts · ON-DONE waits)" — that line is doubly false
 * (it asserts a store AND the interrupt semantics `DELIVERY_HINT` corrects).
 */
export const QUEUE_EMPTY_COPY = "The queue read returned no records.";

/** Stale = last-known data. NO retry/reconnect claim — nothing here is recovering on its own. */
export const QUEUE_STALE_COPY = "Queue disconnected — showing the last received list.";

export const QUEUE_LOADING_COPY = "Loading queue…";

/** The three unavailable reasons, each with its own copy. Asserted pairwise-distinct by test. */
export const QUEUE_UNAVAILABLE_COPY: Record<QueueUnavailableReason, string> = {
  unsupported: "Queued delivery is unavailable in this mode.",
  error: "The queue could not be read.",
  unaddressable: "This session has no queue address.",
};

export const QUEUE_CANCEL_ASK = "Cancel this delivery?";
export const QUEUE_CANCEL_YES = "Cancel it";
export const QUEUE_CANCEL_NO = "Keep";
export const QUEUE_CANCEL_LABEL = "✕ cancel";

/**
 * The queue's input. `stale` is its OWN state, never folded into `ok` — a failing poll that still
 * holds the last received list is a materially different claim from a fresh successful read.
 */
export type QueueSource =
  | { kind: "loading" }
  | { kind: "unavailable"; reason: QueueUnavailableReason }
  | { kind: "ok"; items: readonly QueueItem[] }
  | { kind: "stale"; items: readonly QueueItem[] };

/** What the panel body renders. `empty` is reachable from exactly one source arm — see below. */
export type QueueView =
  | { kind: "state"; copy: string }
  | { kind: "empty"; copy: string }
  | { kind: "list"; items: readonly QueueItem[]; staleCopy: string | null };

/**
 * HONESTY INVARIANT (binding): the empty presentation renders ONLY on `ok` + zero items — i.e. only
 * after a fresh successful read actually returned nothing.
 *  - `loading` renders the loading state, NEVER "empty" (an unfinished read knows nothing yet).
 *  - `unavailable` renders its own distinct reason copy, NEVER "empty".
 *  - `stale` with zero items renders a flagged (but empty) LIST, never the empty copy — the last
 *    received list happening to be empty is not a fresh "there is nothing queued" claim.
 *
 * `unavailableCopy` lets a product supply a more specific, still-honest reason string per reason;
 * omitting it falls back to this package's defaults. It cannot collapse two reasons into one
 * message by accident — the reasons remain distinct keys either way.
 */
export function queueView(
  source: QueueSource,
  unavailableCopy?: Partial<Record<QueueUnavailableReason, string>>,
): QueueView {
  switch (source.kind) {
    case "loading":
      return { kind: "state", copy: QUEUE_LOADING_COPY };
    case "unavailable":
      return { kind: "state", copy: unavailableCopy?.[source.reason] ?? QUEUE_UNAVAILABLE_COPY[source.reason] };
    case "ok":
      return source.items.length === 0
        ? { kind: "empty", copy: QUEUE_EMPTY_COPY }
        : { kind: "list", items: source.items, staleCopy: null };
    case "stale":
      return { kind: "list", items: source.items, staleCopy: QUEUE_STALE_COPY };
  }
}

// ── class + label derivation ──

/** ASAP / ON-DONE badge label (verbatim). */
export function queueBadgeLabel(cls: DeliveryClass): "ASAP" | "ON-DONE" {
  return deliveryClassLabel(cls);
}

/** Badge class: ASAP → accent-soft, ON-DONE → disabled-muted (design card). */
export function queueBadgeClass(cls: DeliveryClass): string {
  return cls === "asap" ? "my-qbadge my-qbadge--asap" : "my-qbadge my-qbadge--done";
}

/** The row class. An armed row swaps to the confirm presentation instead of a status modifier. */
export function queueRowClass(status: QueueItemStatus, armed: boolean): string {
  return armed ? "my-qrow is-confirm" : `my-qrow my-qrow--${status}`;
}

/** Human status label — the status verbatim, never a friendlier synonym that loses precision. */
export function queueStatusLabel(status: QueueItemStatus): string {
  return status;
}

/**
 * HONESTY INVARIANT (binding): the cancel affordance exists ONLY on `queued` records AND only when
 * the caller says the record is cancellable at all (`canCancel` — e.g. the viewer owns the queue).
 * Every other status renders WITHOUT an active cancel control: no greyed-out button that implies a
 * cancel could have happened, and never a control whose click would be rejected downstream.
 */
export function canCancelRow(status: QueueItemStatus, canCancel: boolean): boolean {
  return canCancel && status === "queued";
}

// ── two-step inline-cancel state machine (pure) ──

export type CancelState = { armedId: string | null };
export type CancelEvent = { type: "arm"; id: string } | { type: "confirm" } | { type: "disarm" };

export function cancelReducer(state: CancelState, event: CancelEvent): CancelState {
  switch (event.type) {
    case "arm":
      return { armedId: event.id };
    case "confirm":
      return { armedId: null }; // the onCancel(id) side-effect belongs to the component, not here
    case "disarm":
      return { armedId: null };
  }
}

/**
 * An armed two-step cancel must NEVER outlive its cancelability. Force-disarm when cancelability is
 * lost (`canCancel` flips false), OR the armed row is no longer a live `queued` record in the
 * CURRENT source — it left the queue (leased/delivered/canceled), vanished, or the source went
 * unavailable/loading (no items at all).
 */
export function shouldDisarmCancel(armedId: string | null, canCancel: boolean, source: QueueSource): boolean {
  if (armedId === null) return false;
  if (!canCancel) return true;
  const items = source.kind === "ok" || source.kind === "stale" ? source.items : [];
  const row = items.find((it) => it.id === armedId);
  return row === undefined || !canCancelRow(row.status, canCancel);
}
