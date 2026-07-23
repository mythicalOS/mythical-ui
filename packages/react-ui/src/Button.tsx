// @mythicalos/react-ui — Button (ds/components-buttons: primary/accent/secondary/ghost/danger,
// each × default/hover/active/focus/disabled/loading). Classes only. Loading keeps the label
// (stable width), shows a currentColor spinner, and is inert + aria-busy (book §6).
//
// React twin of packages/preact-ui/src/Button.tsx. The class derivation (`buttonClass`) lives in
// `@mythicalos/ui-core` (Task 2) — this binding only renders, it never builds the class string
// itself.

import type { MouseEvent, ReactNode } from "react";
import { buttonClass, type BtnVariant, type BtnState } from "@mythicalos/ui-core/logic";

export { buttonClass, type BtnVariant, type BtnState };

export interface ButtonProps {
  variant?: BtnVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}

export function Button(props: ButtonProps) {
  const { variant = "sec", loading = false, disabled = false, small = false } = props;
  const inert = disabled || loading;
  return (
    <button
      type={props.type ?? "button"}
      className={buttonClass(variant, { loading, disabled, small })}
      disabled={inert}
      aria-busy={loading ? "true" : undefined}
      title={props.title}
      onClick={inert ? undefined : props.onClick}
    >
      {loading ? <span className="spin" aria-hidden="true" /> : null}
      {props.children}
    </button>
  );
}
