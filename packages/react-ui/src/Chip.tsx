// @mythicalos/react-ui — Chip / badge (non-interactive tag; pill radius is for tags only, design
// rule #20 — interactables stay squared). tone: neutral | accent | ok | warn | error | info.
//
// React twin of packages/preact-ui/src/Chip.tsx. `chipClass` (tone→class derivation) is imported
// from `@mythicalos/ui-core`, never reimplemented — this binding only renders.
//
// Preact→React prop delta: the Preact sibling's passthrough class prop is named `class`; here it's
// `className` (the idiomatic React name — `class` is a legal but un-idiomatic prop key that every
// React consumer would reach for `className` first). This is the one deliberate public-API rename
// in this package; see the task report's "concerns" section.

import type { ReactNode } from "react";
import { chipClass, type ChipTone } from "@mythicalos/ui-core/logic";

export { chipClass, type ChipTone };

export interface ChipProps {
  tone?: ChipTone;
  className?: string;
  children?: ReactNode;
}

export function Chip(props: ChipProps) {
  const { tone = "neutral", className: cls = "" } = props;
  return <span className={`${chipClass(tone)} ${cls}`}>{props.children}</span>;
}
