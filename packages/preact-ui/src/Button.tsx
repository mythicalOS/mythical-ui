/** @jsxImportSource preact */
// @mythicalos/preact-ui — Button (ds/components-buttons: primary/accent/secondary/ghost/danger,
// each × default/hover/active/focus/disabled/loading). Classes only. Loading keeps the label
// (stable width), shows a currentColor spinner, and is inert + aria-busy (book §6).
//
// Ported from mythical-skuld's packages/preact-ui/src/Button.tsx. The class derivation
// (`buttonClass`) that file computed locally in a sibling `derive.ts` now lives in
// `@mythicalos/ui-core` (Task 2) — this binding only renders, it never builds the class string
// itself.

import type { ComponentChildren, JSX } from "preact";
import { buttonClass, type BtnVariant, type BtnState } from "@mythicalos/ui-core/logic";

export { buttonClass, type BtnVariant, type BtnState };

export interface ButtonProps {
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  children?: ComponentChildren;
}

export function Button(props: ButtonProps) {
  const { variant = "sec", loading = false, disabled = false, small = false } = props;
  const inert = disabled || loading;
  return (
    <button
      type={props.type ?? "button"}
      class={buttonClass(variant, { loading, disabled, small })}
      disabled={inert}
      aria-busy={loading ? "true" : undefined}
      title={props.title}
      onClick={inert ? undefined : props.onClick}
    >
      {loading ? <span class="spin" aria-hidden="true" /> : null}
      {props.children}
    </button>
  );
}
