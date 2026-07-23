/** @jsxImportSource preact */
// @mythicalos/preact-ui — toasts (ds/components-toasts): tone-colored (ok = surface/ink/border;
// warn/error/info = soft fill + status ink/border), icon + bold lead carry the state (never color
// alone). Auto-dismiss every tone on one cadence; each stacked toast runs its own timer. Max 3
// visible — older collapse into "+n more".
//
// Ported from mythical-skuld's packages/preact-ui/src/Toast.tsx. `composeToastText`/`TOAST_SEP`
// were defined locally there — they now live in `@mythicalos/ui-core` (Task 2, ported verbatim);
// the tone→icon/dismiss-cadence lookup tables stay local (literal presentational maps, not
// branchy derivation — ui-core's tone.ts has no toast-icon module).

import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { ToastContext, type ToastSpec, type ToastStatus } from "./toast-context.js";
import { composeToastText, TOAST_SEP } from "@mythicalos/ui-core/logic";

export { composeToastText, TOAST_SEP };

const ICON: Record<ToastStatus, string> = { ok: "✓", info: "ℹ", warn: "▲", error: "⬤" };
const DISMISS_MS: Record<ToastStatus, number | null> = { ok: 2600, info: 2600, warn: 2600, error: 2600 };

interface LiveToast extends ToastSpec {
  id: number;
}

export function ToastProvider(props: { children: ComponentChildren }) {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (spec: ToastSpec) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...spec, id }]);
      const ms = DISMISS_MS[spec.status];
      if (ms !== null) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), ms),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const t of map.values()) clearTimeout(t);
      map.clear();
    };
  }, []);

  const bus = useMemo(() => ({ push }), [push]);
  const visible = toasts.slice(-3);
  const hiddenCount = toasts.length - visible.length;

  return (
    <ToastContext.Provider value={bus}>
      {props.children}
      <div class="toast-stack" aria-live="polite">
        {hiddenCount > 0 ? <div class="toast-more">+{hiddenCount} more</div> : null}
        {visible.map((t) => (
          <Toast key={t.id} status={t.status} title={t.title} body={t.body} action={t.action} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export interface ToastProps {
  status: ToastStatus;
  title: string;
  body?: string;
  action?: { label: string; onAction: () => void };
  onClose?: () => void;
}

export function Toast(props: ToastProps) {
  return (
    <div class={`toast toast--${props.status}`} role="status">
      <i class="toast-icon" aria-hidden="true">
        {ICON[props.status]}
      </i>
      <span>
        <b>{props.title}</b>
        {props.body ? <>{TOAST_SEP}{props.body}</> : null}
      </span>
      {props.action ? (
        <button type="button" class="toast-action" onClick={props.action.onAction}>
          {props.action.label}
        </button>
      ) : null}
      <button type="button" class="toast-x" aria-label="Dismiss" onClick={props.onClose}>
        ✕
      </button>
    </div>
  );
}
