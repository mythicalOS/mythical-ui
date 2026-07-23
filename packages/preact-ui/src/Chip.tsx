/** @jsxImportSource preact */
// @mythicalos/preact-ui — Chip / badge (non-interactive tag; pill radius is for tags only, design
// rule #20 — interactables stay squared). tone: neutral | accent | ok | warn | error | info.
//
// Ported from design-export's packages/preact-ui/src/components/Chip.jsx (JSX→TSX, typed props).
// The source built its class string inline (`` `my-chip${t} ${cls}` `` with a local `tone === 'neutral'
// ? '' : ...` branch); that tone→class derivation now lives in `@mythicalos/ui-core` as `chipClass`
// (Task 2) — this binding only renders.

import type { ComponentChildren } from "preact";
import { chipClass, type ChipTone } from "@mythicalos/ui-core/logic";

export { chipClass, type ChipTone };

export interface ChipProps {
  tone?: ChipTone;
  class?: string;
  children?: ComponentChildren;
}

export function Chip(props: ChipProps) {
  const { tone = "neutral", class: cls = "" } = props;
  return <span class={`${chipClass(tone)} ${cls}`}>{props.children}</span>;
}
