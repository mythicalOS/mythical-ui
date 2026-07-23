// @mythicalos/react-ui — the designed empty moments (book §7.10 / ds/layouts-observability): muted
// hollow spine nodes + one petrol node = "where you are". Never a disabled ghost form, never an
// error tone. unconfigured ⇒ the live tip is the setup step; asleep ⇒ the hollow tip waits; neutral
// ⇒ no spine art (a plain designed empty). unconfigured/asleep carry the spine motif.
//
// React twin of packages/preact-ui/src/EmptyState.tsx. SVG presentation attributes go through
// React's camelCase props (`strokeWidth`/`strokeDasharray`/`strokeLinecap`) — React serializes them
// back to the same kebab-case DOM attributes (`stroke-width`/…) so the rendered markup is
// byte-identical to the Preact sibling's.

import type { ReactNode } from "react";

export interface EmptyStateProps {
  variant: "unconfigured" | "asleep" | "neutral";
  title: string;
  body: string;
  actions?: ReactNode;
}

function SpineArt(props: { variant: EmptyStateProps["variant"] }) {
  if (props.variant === "unconfigured") {
    // solid up to the live petrol tip, dashed beyond; hollow muted nodes = not-yet
    // (§1a-8: package-owned tokenized classes — no literal strokes, no gauge-block classes)
    return (
      <svg className="spine-empty" viewBox="0 0 200 36" role="img" aria-label="setup is the live step">
        <line className="spine-track" x1="10" y1="18" x2="118" y2="18" strokeWidth="3" />
        <line
          className="spine-dash"
          x1="118"
          y1="18"
          x2="190"
          y2="18"
          strokeWidth="3"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
        <circle className="spine-node" cx="10" cy="18" r="7" strokeWidth="3" />
        <circle className="spine-node" cx="64" cy="18" r="7" strokeWidth="3" />
        <circle className="spine-here" cx="118" cy="18" r="8" />
      </svg>
    );
  }
  if (props.variant === "asleep") {
    return (
      <svg className="spine-empty" viewBox="0 0 200 36" role="img" aria-label="the hollow tip waits">
        <line className="spine-track" x1="10" y1="18" x2="190" y2="18" strokeWidth="3" />
        <circle className="spine-dot" cx="10" cy="18" r="7" />
        <circle className="spine-dot" cx="64" cy="18" r="7" />
        <circle className="spine-dot" cx="118" cy="18" r="7" />
        <circle className="spine-node" cx="182" cy="18" r="8" strokeWidth="3" />
      </svg>
    );
  }
  return null;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div className="empty">
      <SpineArt variant={props.variant} />
      <h2>{props.title}</h2>
      <p>{props.body}</p>
      {props.actions ? <div className="ebtns">{props.actions}</div> : null}
    </div>
  );
}
