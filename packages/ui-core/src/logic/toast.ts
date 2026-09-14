// @mythicalos/ui-core — the toast's pure types, text composition, dismiss policy and stack state
// (ds/components-toasts). Ported from the family's internal Preact atoms package (toast-context.ts)
// (the `ToastStatus`/`ToastSpec`/`ToastBus` types) and src/Toast.tsx (`composeToastText`/`TOAST_SEP`).
// The `ToastContext`/`useToast` bus wiring (createContext/useContext) and the `Toast`/`ToastProvider`
// renderers are framework-bound and stay in the binding packages — this package must never import
// `preact` or `react`.
//
// The dismiss cadence and the collapse used to be literal tables inside each binding, which is how
// a policy drifts: two copies, one clock each, and no test that could see the difference. Both now
// derive from `TOAST_DISMISS_MS` and `createToastStack` here, so the Preact and React toasts cannot
// dismiss on different clocks and the behaviour is provable without a DOM.

export type ToastStatus = "ok" | "warn" | "error" | "info";

export interface ToastSpec {
  status: ToastStatus;
  title: string;
  body?: string;
  action?: { label: string; onAction: () => void };
}

export interface ToastBus {
  push: (t: ToastSpec) => void;
}

/** The separator the toast places between its bold title and its body. */
export const TOAST_SEP = " — ";

/** The toast's composed VISIBLE text: the title, then the separator + body when a body is present.
 *  Mirrors the render in the binding package (bold title notwithstanding) so callers can assert the
 *  exact rendered string without a DOM — and so a body that already repeats the title (the doubled-
 *  prefix bug) is caught by a test. Keep this and the binding's JSX in lockstep. */
export function composeToastText(title: string, body?: string): string {
  return body ? `${title}${TOAST_SEP}${body}` : title;
}

/**
 * The auto-dismiss policy, in ONE place for every binding and every product that mounts a
 * toast stack. `null` means the toast carries no deadline at all: it stays until the operator
 * closes it. That is the whole point of the table — a failure the operator has to act on must
 * not be timed out from under them, while a success that needs no action gets out of the way.
 * `null` is deliberately not `0`, which would dismiss on the next tick.
 *
 * The ladder is graded by how much there is to read and how much it costs to miss it:
 * a success is a glance, an error is usually a sentence plus a reason.
 */
export const TOAST_DISMISS_MS: Record<ToastStatus, number | null> = {
  ok: 2600,
  info: 4000,
  warn: 8000,
  error: null,
};

/** The policy lookup. `null` ⇒ no deadline: this tone stays until it is closed. */
export function toastDismissMs(status: ToastStatus): number | null {
  return TOAST_DISMISS_MS[status];
}

/** How many toasts a collapsed stack renders; the rest are counted by the expand control. */
export const TOAST_MAX_VISIBLE = 3;

/** The expanded stack's control label — the way back to the collapsed stack. */
export const TOAST_COLLAPSE_LABEL = "Show fewer";

export interface ToastStackView<T> {
  /** The toasts to render, oldest first, in the stack's own order. */
  visible: readonly T[];
  /** How many are NOT rendered right now. 0 while expanded — nothing is hidden then. */
  hiddenCount: number;
  /** True while the stack holds more than fits collapsed — i.e. there IS a control to draw. */
  collapsible: boolean;
  expanded: boolean;
  /** The control's label, or `null` when there is no control to draw. */
  moreLabel: string | null;
}

/**
 * The collapse, as pure data: which toasts render, how many are held back, and the label of the
 * control that reaches them. Collapsed, the NEWEST `TOAST_MAX_VISIBLE` render (the older ones are
 * the ones already read); expanded, all of them do. Never mutates its input.
 */
export function toastStackView<T>(toasts: readonly T[], expanded: boolean): ToastStackView<T> {
  const collapsible = toasts.length > TOAST_MAX_VISIBLE;
  const visible = collapsible && !expanded ? toasts.slice(-TOAST_MAX_VISIBLE) : toasts.slice();
  return {
    visible,
    hiddenCount: toasts.length - visible.length,
    collapsible,
    expanded,
    moreLabel: collapsible ? (expanded ? TOAST_COLLAPSE_LABEL : `+${toasts.length - visible.length} more`) : null,
  };
}

/**
 * Why the deadlines are being held. The stack pauses while ANY reason is live and resumes only
 * when the LAST one is released — a single boolean cannot express that: hovering the stack and
 * then tabbing into it gives two independent holds, and the pointer leaving first would otherwise
 * resume every timer while the keyboard is still inside, dismissing what the operator is reading.
 */
export type ToastHoldReason = "pointer" | "focus";

/** A toast the stack is holding: the pushed spec plus the id the stack minted for it. */
export interface LiveToast extends ToastSpec {
  id: number;
}

/** Whatever the host's timer API hands back — a number in a browser, an object under Bun/Node. */
export type ToastTimerHandle = unknown;

/** The timer seam. Injectable so the dismiss policy can be tested on a clock a test controls. */
export interface ToastClock {
  now(): number;
  setTimer(fn: () => void, ms: number): ToastTimerHandle;
  clearTimer(handle: ToastTimerHandle): void;
}

export interface ToastStack {
  /** Add a toast; returns its id. Arms its deadline unless the tone has none, or the stack is paused. */
  push(spec: ToastSpec): number;
  /** Remove a toast and disarm its deadline. An id the stack does not hold changes nothing. */
  dismiss(id: number): void;
  /**
   * Hold / release every deadline, one reason at a time. While held, each running toast keeps the
   * time it had left and nothing expires; on release each is re-armed with exactly that remainder.
   * Holds combine: the stack resumes only when every reason has been released. Idempotent — the
   * same reason held twice is one hold, and releasing a reason that was never held does nothing.
   */
  setHold(reason: ToastHoldReason, held: boolean): void;
  /** True while at least one hold is live. */
  isPaused(): boolean;
  /** Show every held-back toast, or collapse back to the newest few. */
  toggleExpanded(): void;
  isExpanded(): boolean;
  /** Everything the stack holds, oldest first. */
  toasts(): readonly LiveToast[];
  /** What to render right now — the collapse applied to the live stack. */
  view(): ToastStackView<LiveToast>;
  /** ms left on `id`'s deadline; `null` when it has none; `undefined` when the stack has no such id. */
  remainingMs(id: number): number | null | undefined;
  /** Called after every change worth repainting. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Disarm every deadline and drop every subscriber — the owner is going away. */
  destroy(): void;
}

const defaultClock: ToastClock = {
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The toast stack as framework-agnostic state: the list, the per-toast deadlines, the
 * hover/focus hold, and the collapse. A binding is then only wiring — it renders `view()` and
 * calls back in — so the Preact and React toasts cannot dismiss on different clocks, and the
 * behaviour is provable without a DOM.
 *
 * The stack is deliberately NOT capped: with `error: null`, capping would mean silently dropping
 * a failure the operator never read, which is the failure this policy exists to prevent. Depth is
 * reachable instead — every toast beyond the visible few is counted and one click away.
 */
export function createToastStack(clock: Partial<ToastClock> = {}): ToastStack {
  const { now, setTimer, clearTimer } = { ...defaultClock, ...clock };

  interface Entry {
    /** ms still to run. Always the live remainder while paused. */
    remaining: number;
    /** now() + remaining while running; null while paused. */
    deadline: number | null;
    handle: ToastTimerHandle | null;
  }

  let toasts: LiveToast[] = [];
  let nextId = 1;
  const holds = new Set<ToastHoldReason>();
  let expanded = false;
  const entries = new Map<number, Entry>();
  let listeners: Array<() => void> = [];

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const disarm = (entry: Entry) => {
    if (entry.handle !== null) {
      clearTimer(entry.handle);
      entry.handle = null;
    }
    entry.deadline = null;
  };

  const arm = (id: number, entry: Entry) => {
    entry.deadline = now() + entry.remaining;
    entry.handle = setTimer(() => {
      entry.handle = null;
      remove(id);
      notify();
    }, entry.remaining);
  };

  /** Drop `id` without notifying — the callers decide whether the change is worth a repaint. */
  function remove(id: number): boolean {
    const entry = entries.get(id);
    if (entry) {
      disarm(entry);
      entries.delete(id);
    }
    const before = toasts.length;
    toasts = toasts.filter((t) => t.id !== id);
    if (toasts.length === before) return false;
    if (toasts.length <= TOAST_MAX_VISIBLE) expanded = false;
    return true;
  }

  return {
    push(spec) {
      const id = nextId++;
      toasts = [...toasts, { ...spec, id }];
      const ms = toastDismissMs(spec.status);
      if (ms !== null) {
        const entry: Entry = { remaining: ms, deadline: null, handle: null };
        entries.set(id, entry);
        if (holds.size === 0) arm(id, entry);
      }
      notify();
      return id;
    },

    dismiss(id) {
      if (remove(id)) notify();
    },

    setHold(reason, held) {
      const wasPaused = holds.size > 0;
      if (held) holds.add(reason);
      else holds.delete(reason);
      const isPaused = holds.size > 0;
      if (isPaused === wasPaused) return; // another reason still holds, or none ever did
      for (const [id, entry] of entries) {
        if (isPaused) {
          entry.remaining = Math.max(0, (entry.deadline ?? now()) - now());
          disarm(entry);
        } else {
          arm(id, entry);
        }
      }
      notify();
    },

    isPaused: () => holds.size > 0,

    toggleExpanded() {
      expanded = !expanded && toasts.length > TOAST_MAX_VISIBLE;
      notify();
    },

    isExpanded: () => expanded,

    toasts: () => toasts,

    view: () => toastStackView(toasts, expanded),

    remainingMs(id) {
      if (!toasts.some((t) => t.id === id)) return undefined;
      const entry = entries.get(id);
      if (!entry) return null;
      return entry.deadline === null ? entry.remaining : Math.max(0, entry.deadline - now());
    },

    subscribe(listener) {
      listeners = [...listeners, listener];
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },

    destroy() {
      for (const entry of entries.values()) disarm(entry);
      entries.clear();
      listeners = [];
    },
  };
}
