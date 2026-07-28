/** @jsxImportSource preact */
// @mythicalos/preact-ui — Button (ds/components-buttons: primary/accent/secondary/ghost/danger,
// each × default/hover/active/focus/disabled/loading). Classes only. Loading keeps the label
// (stable width), shows a currentColor spinner, and is inert + aria-busy (book §6).
//
// Ported from the family's internal Preact atoms package (Button.tsx). The class derivation
// (`buttonClass`) that file computed locally in a sibling `derive.ts` now lives in
// `@mythicalos/ui-core` (Task 2) — this binding only renders, it never builds the class string
// itself.

import type { ComponentChildren, JSX } from "preact";
import { buttonClass, type BtnVariant, type BtnState, type BtnTone } from "@mythicalos/ui-core/logic";

export { buttonClass, type BtnVariant, type BtnState, type BtnTone };

export interface ButtonProps {
  variant?: BtnVariant;
  /** Status-tone fill (ds/components-buttons tone row). Setting this forces the `tone` variant
   * and renders `data-tone` — it wins over `variant`. `error` fills are rule-9-scoped
   * (lifecycle confirm flows only). */
  tone?: BtnTone;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  title?: string;
  onClick?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
  children?: ComponentChildren;
}

export function Button(props: ButtonProps) {
  // Normalize falsy tone ("" from an unchecked JS consumer) to unset, so the class string and
  // the data-tone attribute can never disagree.
  const tone = props.tone || undefined;
  const { variant = "sec", loading = false, disabled = false, small = false } = props;
  const inert = disabled || loading;
  return (
    <button
      type={props.type ?? "button"}
      class={buttonClass(tone ? "tone" : variant, { loading, disabled, small })}
      data-tone={tone}
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
