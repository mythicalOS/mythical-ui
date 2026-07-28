/** @jsxImportSource preact */
// @mythicalos/preact-ui — Flag: the squared, mono, uppercase member of the design system's
// "Tags & chips" card. It carries MACHINE facts — kinds, counters, diff letters — where Tag
// carries human labels. Non-interactive, like Tag; only ChipDropdown is clickable.
//
// The card's rule for tones: flags are honest counters, never decoration — warn-soft for
// behind/uncommitted, error-soft ONLY for something that can be lost, ok-soft for a clean tree.
// The uppercase reading of the card's examples is the CALLER's text, not a `text-transform` here:
// forcing case would silently rewrite a case-sensitive machine fact (a diff letter, a ref name).
//
// This file is WIRING ONLY — `flagClass` lives in `@mythicalos/ui-core`, so this binding and its
// React sibling cannot drift.

import type { ComponentChildren } from "preact";
import { flagClass, type FlagTone } from "@mythicalos/ui-core/logic";

export { flagClass, FLAG_TONES, FLAG_PARTS, type FlagTone } from "@mythicalos/ui-core/logic";

export interface FlagProps {
  /** `accent` (the default) is the base rule and emits no modifier. */
  tone?: FlagTone;
  class?: string;
  children?: ComponentChildren;
}

export function Flag(props: FlagProps) {
  const { tone = "accent", class: cls = "" } = props;
  return <span class={`${flagClass(tone)} ${cls}`}>{props.children}</span>;
}
