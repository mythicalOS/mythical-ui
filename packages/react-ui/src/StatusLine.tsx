// @mythicalos/react-ui — status dot + label. Plain text (no pill) — for top-bar status clusters
// and inline states. tone: ok | warn | error | info | muted | accent.
//
// React twin of packages/preact-ui/src/StatusLine.tsx. `statusLineClass` (tone→class derivation) is
// imported from `@mythicalos/ui-core`, never reimplemented — this binding only renders.

import type { ReactNode } from "react";
import { statusLineClass, type StatusTone } from "@mythicalos/ui-core/logic";

export { statusLineClass, type StatusTone };

export interface StatusLineProps {
  tone?: StatusTone;
  children?: ReactNode;
}

export function StatusLine(props: StatusLineProps) {
  const { tone = "ok" } = props;
  return (
    <span className={statusLineClass(tone)}>
      <span className="my-status__dot" />
      {props.children}
    </span>
  );
}
