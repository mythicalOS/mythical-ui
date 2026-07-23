/** @jsxImportSource preact */
// @mythicalos/preact-ui — status dot + label. Plain text (no pill) — for top-bar status clusters
// and inline states. tone: ok | warn | error | info | muted | accent.
//
// Ported from design-export's packages/preact-ui/src/components/Status.jsx (which exports
// `StatusLine`; JSX→TSX, typed props). The source built its class string inline
// (`` `my-status my-status--${tone}` ``); that tone→class derivation now lives in
// `@mythicalos/ui-core` as `statusLineClass` (Task 2) — this binding only renders.

import type { ComponentChildren } from "preact";
import { statusLineClass, type StatusTone } from "@mythicalos/ui-core/logic";

export { statusLineClass, type StatusTone };

export interface StatusLineProps {
  tone?: StatusTone;
  children?: ComponentChildren;
}

export function StatusLine(props: StatusLineProps) {
  const { tone = "ok" } = props;
  return (
    <span class={statusLineClass(tone)}>
      <span class="my-status__dot" />
      {props.children}
    </span>
  );
}
