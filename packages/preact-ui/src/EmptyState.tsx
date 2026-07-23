/** @jsxImportSource preact */
// @mythicalos/preact-ui — the designed empty moments (book §7.10 / ds/layouts-observability): muted
// hollow spine nodes + one petrol node = "where you are". Never a disabled ghost form, never an
// error tone. unconfigured ⇒ the live tip is the setup step; asleep ⇒ the hollow tip waits; neutral
// ⇒ no spine art (a plain designed empty). unconfigured/asleep carry the spine motif.
//
// Ported verbatim from mythical-skuld's packages/preact-ui/src/EmptyState.tsx.

import type { ComponentChildren } from "preact";

export interface EmptyStateProps {
  variant: "unconfigured" | "asleep" | "neutral";
  title: string;
  body: string;
  actions?: ComponentChildren;
}

function SpineArt(props: { variant: EmptyStateProps["variant"] }) {
  if (props.variant === "unconfigured") {
    // solid up to the live petrol tip, dashed beyond; hollow muted nodes = not-yet
    // (§1a-8: package-owned tokenized classes — no literal strokes, no gauge-block classes)
    return (
      <svg class="spine-empty" viewBox="0 0 200 36" role="img" aria-label="setup is the live step">
        <line class="spine-track" x1="10" y1="18" x2="118" y2="18" stroke-width="3" />
        <line class="spine-dash" x1="118" y1="18" x2="190" y2="18" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" />
        <circle class="spine-node" cx="10" cy="18" r="7" stroke-width="3" />
        <circle class="spine-node" cx="64" cy="18" r="7" stroke-width="3" />
        <circle class="spine-here" cx="118" cy="18" r="8" />
      </svg>
    );
  }
  if (props.variant === "asleep") {
    return (
      <svg class="spine-empty" viewBox="0 0 200 36" role="img" aria-label="the hollow tip waits">
        <line class="spine-track" x1="10" y1="18" x2="190" y2="18" stroke-width="3" />
        <circle class="spine-dot" cx="10" cy="18" r="7" />
        <circle class="spine-dot" cx="64" cy="18" r="7" />
        <circle class="spine-dot" cx="118" cy="18" r="7" />
        <circle class="spine-node" cx="182" cy="18" r="8" stroke-width="3" />
      </svg>
    );
  }
  return null;
}

export function EmptyState(props: EmptyStateProps) {
  return (
    <div class="empty">
      <SpineArt variant={props.variant} />
      <h2>{props.title}</h2>
      <p>{props.body}</p>
      {props.actions ? <div class="ebtns">{props.actions}</div> : null}
    </div>
  );
}
