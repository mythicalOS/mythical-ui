// @mythicalos/preact-ui — the toast bus context (decoupled from any app API client). mythical-ui
// originally declared these alongside its ApiContext; the extraction splits the app-agnostic toast
// bus out so both family UIs share one implementation. The app provides <ToastProvider> at its root
// and components push via useToast().
//
// Ported from the family's internal Preact atoms package (toast-context.ts). The `ToastStatus`/
// `ToastSpec`/`ToastBus` types were declared locally there — they now live in `@mythicalos/ui-core`
// (Task 2, ported verbatim); only the Preact `createContext`/`useContext` wiring stays here.

import { createContext } from "preact";
import { useContext } from "preact/hooks";
import { type ToastStatus, type ToastSpec, type ToastBus } from "@mythicalos/ui-core/logic";

export { type ToastStatus, type ToastSpec, type ToastBus };

export const ToastContext = createContext<ToastBus>({ push: () => {} });

export function useToast(): ToastBus {
  return useContext(ToastContext);
}
