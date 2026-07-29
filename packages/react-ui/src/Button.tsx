// @mythicalos/react-ui — Button (ds/components-buttons: primary/accent/secondary/ghost/danger,
// each × default/hover/active/focus/disabled/loading). Classes only. Loading keeps the label
// (stable width), shows a currentColor spinner, and is inert + aria-busy (book §6).
//
// React twin of packages/preact-ui/src/Button.tsx. The class derivation (`buttonClass`) lives in
// `@mythicalos/ui-core` (Task 2) — this binding only renders, it never builds the class string
// itself.

import type { MouseEvent, ReactNode } from "react";
import { buttonClass, type BtnVariant, type BtnState, type BtnTone } from "@mythicalos/ui-core/logic";

export { buttonClass, type BtnVariant, type BtnState, type BtnTone };

export interface ButtonProps {
  variant?: BtnVariant;
  /** Status tone (ds/components-buttons tone rows). With any fill/outline variant BUT
   * `tone-line`, setting this forces the `tone` FILL and wins over `variant`; with
   * `variant="tone-line"` it rides the OUTLINE mirror instead — the same `data-tone` axis,
   * whose `error` arm ≡ the standing `.btn--dan` contract. `error` fills are rule-9-scoped
   * (lifecycle confirm flows only). */
  tone?: BtnTone;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  children?: ReactNode;
}

export function Button(props: ButtonProps) {
  // Normalize falsy tone ("" from an unchecked JS consumer) to unset, so the class string and
  // the data-tone attribute can never disagree.
  const tone = props.tone || undefined;
  const { variant = "sec", loading = false, disabled = false, small = false } = props;
  // The outline mirror keeps its variant and lets the tone ride the attribute; any other
  // variant is forced onto the fill when a tone is set (the original tone-wins rule).
  const resolved = variant === "tone-line" ? variant : tone ? "tone" : variant;
  const inert = disabled || loading;
  return (
    <button
      type={props.type ?? "button"}
      className={buttonClass(resolved, { loading, disabled, small })}
      data-tone={tone}
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
