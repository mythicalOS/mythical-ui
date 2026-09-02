// @mythicalos/react-ui — the toast bus context (decoupled from any app API client). Shared with the
// Preact sibling so both family UIs can push toasts through one implementation shape. The app
// provides <ToastProvider> at its root and components push via useToast().
//
// React twin of packages/preact-ui/src/toast-context.ts. `ToastStatus`/`ToastSpec`/`ToastBus` are
// imported from `@mythicalos/ui-core` (framework-agnostic); only the `createContext`/`useContext`
// wiring differs — `react` instead of `preact`/`preact/hooks`.

import { createContext, useContext } from "react";
import { type ToastStatus, type ToastSpec, type ToastBus } from "@mythicalos/ui-core/logic";

export { type ToastStatus, type ToastSpec, type ToastBus };

export const ToastContext = createContext<ToastBus>({ push: () => {} });

export function useToast(): ToastBus {
  return useContext(ToastContext);
}
