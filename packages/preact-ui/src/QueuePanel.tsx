/** @jsxImportSource preact */
// @mythicalos/preact-ui — the delivery queue (ds/components-terminal, spec v2): `QueueRow` is the
// registry atom; `QueuePanel` is the list that carries the source→view honesty around it.
//
// Thin binding: render + wiring only. The source resolution, every copy string, the row/badge class
// derivation, and the two-step cancel state machine all come from `@mythicalos/ui-core`.
//
// Honesty (binding, inherited from ui-core): the empty copy is CAPABILITY-NEUTRAL and renders ONLY
// on `ok` + zero items — never an operational-emptiness or store-existence claim, and never the
// design card's "queue empty — deliveries land here by class (ASAP interrupts · ON-DONE waits)";
// `loading` never renders empty; the three unavailable reasons render DISTINCTLY; `stale` is its own
// state, flagged as last-known data with no retry claim. The cancel affordance exists ONLY on
// `queued` records AND only when the caller says the record is cancellable.

import { useEffect, useReducer } from "preact/hooks";
import {
  QUEUE_CANCEL_ASK,
  QUEUE_CANCEL_LABEL,
  QUEUE_CANCEL_NO,
  QUEUE_CANCEL_YES,
  canCancelRow,
  cancelReducer,
  queueBadgeClass,
  queueBadgeLabel,
  queueRowClass,
  queueStatusLabel,
  queueView,
  shouldDisarmCancel,
  type QueueItem,
  type QueueSource,
  type QueueUnavailableReason,
} from "@mythicalos/ui-core/logic";

export {
  QUEUE_EMPTY_COPY,
  QUEUE_LOADING_COPY,
  QUEUE_STALE_COPY,
  QUEUE_UNAVAILABLE_COPY,
  canCancelRow,
  cancelReducer,
  queueBadgeClass,
  queueBadgeLabel,
  queueRowClass,
  queueView,
  shouldDisarmCancel,
  type CancelEvent,
  type CancelState,
  type QueueItem,
  type QueueItemStatus,
  type QueueSource,
  type QueueUnavailableReason,
  type QueueView,
} from "@mythicalos/ui-core/logic";

export interface QueueRowProps {
  item: QueueItem;
  /** The row is showing its two-step confirm instead of its normal presentation. */
  armed?: boolean;
  /** Whether the cancel affordance may exist at all — combined with the status by ui-core. */
  canCancel?: boolean;
  onArm?(): void;
  onConfirm?(): void;
  onDisarm?(): void;
}

/** One queue record. The registry atom — usable standalone, or through `QueuePanel`. */
export function QueueRow(props: QueueRowProps) {
  const { item } = props;
  const badge = <span class={queueBadgeClass(item.cls)}>{queueBadgeLabel(item.cls)}</span>;
  if (props.armed) {
    return (
      <div class={queueRowClass(item.status, true)}>
        {badge}
        <span class="my-qrow__ask">{QUEUE_CANCEL_ASK}</span>
        <span class="my-qrow__acts">
          <button type="button" class="my-qmini my-qmini--yes" onClick={props.onConfirm}>
            {QUEUE_CANCEL_YES}
          </button>
          <button type="button" class="my-qmini my-qmini--no" onClick={props.onDisarm}>
            {QUEUE_CANCEL_NO}
          </button>
        </span>
      </div>
    );
  }
  return (
    <div class={queueRowClass(item.status, false)}>
      {badge}
      <span class="my-qrow__body">{item.body}</span>
      <span class="my-qrow__status">{queueStatusLabel(item.status)}</span>
      {canCancelRow(item.status, !!props.canCancel) ? (
        <button type="button" class="my-qrow__cancel" onClick={props.onArm}>
          {QUEUE_CANCEL_LABEL}
        </button>
      ) : null}
    </div>
  );
}

export interface QueuePanelProps {
  source: QueueSource;
  /** Whether cancelling is possible at all right now (e.g. the viewer owns the queue). */
  canCancel?: boolean;
  onCancel?(id: string): void;
  /** Changing this clears any pending confirm (e.g. the selected target changed). */
  resetKey?: string;
  /** Product-specific — still honest — copy per unavailable reason. Reasons stay distinct. */
  unavailableCopy?: Partial<Record<QueueUnavailableReason, string>>;
}

export function QueuePanel(props: QueuePanelProps) {
  const { source } = props;
  const canCancel = !!props.canCancel;
  const [cancel, dispatch] = useReducer(cancelReducer, { armedId: null });

  // A changed target clears any pending ask.
  useEffect(() => {
    dispatch({ type: "disarm" });
  }, [props.resetKey]);

  // An armed confirm must never outlive its cancelability: ownership loss, or the armed row leaving
  // `queued` in the CURRENT source (leased/delivered/canceled/vanished/unavailable), force-disarms.
  const mustDisarm = shouldDisarmCancel(cancel.armedId, canCancel, source);
  useEffect(() => {
    if (mustDisarm) dispatch({ type: "disarm" });
  }, [mustDisarm]);

  useEffect(() => {
    if (cancel.armedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "disarm" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel.armedId]);

  const view = queueView(source, props.unavailableCopy);

  return (
    <div class="my-queue">
      {view.kind === "state" ? <div class="my-queue__state">{view.copy}</div> : null}
      {view.kind === "empty" ? <div class="my-queue__empty">{view.copy}</div> : null}
      {view.kind === "list" ? (
        <div class="my-queue__list">
          {view.staleCopy !== null ? <div class="my-queue__stale">{view.staleCopy}</div> : null}
          {view.items.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              canCancel={canCancel}
              armed={cancel.armedId === item.id}
              onArm={() => dispatch({ type: "arm", id: item.id })}
              onConfirm={() => {
                // Re-checked at the moment of confirm: the intent only fires if the row is STILL
                // cancellable in the current source — never a stale-arm cancel.
                if (canCancelRow(item.status, canCancel)) props.onCancel?.(item.id);
                dispatch({ type: "confirm" });
              }}
              onDisarm={() => dispatch({ type: "disarm" })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
