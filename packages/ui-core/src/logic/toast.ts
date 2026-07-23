// @mythicalos/ui-core — the pure toast types + text-composition helper (ds/components-toasts).
// Ported from mythical-skuld's packages/preact-ui/src/toast-context.ts (the `ToastStatus`/`ToastSpec`/
// `ToastBus` types) and src/Toast.tsx (`composeToastText`/`TOAST_SEP`). The `ToastContext`/`useToast`
// bus wiring (createContext/useContext) and the `Toast`/`ToastProvider` renderers are Preact-bound
// and stay in the Preact binding package — this package must never import `preact`.

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
