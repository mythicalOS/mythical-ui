/** @jsxImportSource preact */
// @mythicalos/preact-ui — toasts (ds/components-toasts): tone-colored (ok = surface/ink/border;
// warn/error/info = soft fill + status ink/border), icon + bold lead carry the state (never color
// alone). Max 3 visible — the rest collapse behind a "+n more" BUTTON that expands the stack.
//
// Dismissal is policy, and the policy lives in `@mythicalos/ui-core`: ok 2600 · info 4000 ·
// warn 8000 · error null, where null means the toast carries no deadline and stays until the
// operator closes it. A stack that timed every tone out on one cadence left a failure on screen
// exactly as long as a success, so the message an operator most needed to read was the one most
// likely to be gone before they looked. Timed toasts also HOLD while the stack is hovered or
// holds focus, and resume when it is left — reading a toast must not be a race against it.
//
// Ported from the family's internal Preact atoms package (Toast.tsx). `composeToastText`/
// `TOAST_SEP`, the dismiss policy and the stack state (ids, per-toast deadlines, the hold, the
// collapse) all live in `@mythicalos/ui-core`; this file is render + framework wiring only, so it
// and its React sibling cannot drift. Only the tone→icon table stays local — a literal
// presentational map, not behavior (ui-core's tone.ts has no toast-icon module).

import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { ToastContext, type ToastSpec, type ToastStatus } from "./toast-context.js";
import {
  composeToastText,
  createToastStack,
  TOAST_SEP,
  type LiveToast,
  type ToastStackView,
} from "@mythicalos/ui-core/logic";

export { composeToastText, TOAST_SEP };

const ICON: Record<ToastStatus, string> = { ok: "✓", info: "ℹ", warn: "▲", error: "⬤" };

export function ToastProvider(props: { children: ComponentChildren }) {
  const [, repaint] = useState(0);
  const stack = useMemo(() => createToastStack(), []);

  // Subscribing in the effect rather than at creation keeps a remount (a strict/dev double-mount,
  // and the same pass in the React sibling) from leaving the provider deaf to its own stack. The
  // immediate repaint covers anything pushed between creation and this effect.
  useEffect(() => {
    const unsubscribe = stack.subscribe(() => repaint((n) => n + 1));
    repaint((n) => n + 1);
    return () => {
      unsubscribe();
      stack.destroy();
    };
  }, [stack]);

  const bus = useMemo(
    () => ({
      push: (spec: ToastSpec) => {
        stack.push(spec);
      },
    }),
    [stack],
  );
  const dismiss = useCallback((id: number) => stack.dismiss(id), [stack]);
  const toggleExpanded = useCallback(() => stack.toggleExpanded(), [stack]);
  const setPaused = useCallback((paused: boolean) => stack.setPaused(paused), [stack]);

  return (
    <ToastContext.Provider value={bus}>
      {props.children}
      <ToastStackBody
        view={stack.view()}
        onDismiss={dismiss}
        onToggleExpanded={toggleExpanded}
        onPause={setPaused}
      />
    </ToastContext.Provider>
  );
}

export interface ToastStackBodyProps {
  /** What to render — `ToastStack.view()`, i.e. the collapse applied to the live stack. */
  view: ToastStackView<LiveToast>;
  onDismiss: (id: number) => void;
  onToggleExpanded: () => void;
  /** Hold every deadline (pointer/focus in) or release it (out). */
  onPause: (paused: boolean) => void;
}

/**
 * The stack's markup — hook-free and state-free, so any stack state can be rendered (and asserted)
 * without a DOM to push into. `ToastProvider` is this component plus the bus.
 *
 * The hold is on the stack, not on one toast: the pointer resting anywhere over the column, or the
 * keyboard reaching any control inside it, holds every deadline. Focus is watched in the CAPTURE
 * phase because focus/blur do not bubble.
 */
export function ToastStackBody(props: ToastStackBodyProps) {
  return (
    <div
      class="toast-stack"
      aria-live="polite"
      onMouseEnter={() => props.onPause(true)}
      onMouseLeave={() => props.onPause(false)}
      onFocusCapture={() => props.onPause(true)}
      onBlurCapture={() => props.onPause(false)}
    >
      {props.view.moreLabel !== null ? (
        <button
          type="button"
          class="toast-more"
          aria-expanded={props.view.expanded}
          onClick={props.onToggleExpanded}
        >
          {props.view.moreLabel}
        </button>
      ) : null}
      {props.view.visible.map((t) => (
        <Toast
          key={t.id}
          status={t.status}
          title={t.title}
          body={t.body}
          action={t.action}
          onClose={() => props.onDismiss(t.id)}
        />
      ))}
    </div>
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
