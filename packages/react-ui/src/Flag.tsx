// @mythicalos/react-ui — Flag: the squared, mono, uppercase member of the design system's
// "Tags & chips" card. React twin of packages/preact-ui/src/Flag.tsx.
//
// It carries MACHINE facts — kinds, counters, diff letters — where Tag carries human labels.
// Non-interactive, like Tag; only ChipDropdown is clickable. The card's rule for tones: flags are
// honest counters, never decoration — warn-soft for behind/uncommitted, error-soft ONLY for
// something that can be lost, ok-soft for a clean tree. The uppercase reading of the card's
// examples is the CALLER's text, not a `text-transform` here: forcing case would silently rewrite
// a case-sensitive machine fact (a diff letter, a ref name).

import type { ReactNode } from "react";
import { flagClass, type FlagTone } from "@mythicalos/ui-core/logic";

export { flagClass, FLAG_TONES, FLAG_PARTS, type FlagTone } from "@mythicalos/ui-core/logic";

export interface FlagProps {
  /** `accent` (the default) is the base rule and emits no modifier. */
  tone?: FlagTone;
  className?: string;
  /** REQUIRED. A flag is an honest counter, never decoration: a tone with no machine fact
   *  beside it is colour alone, which token rule #7 and the card's do/don't panel both ban. */
  children: ReactNode;
}

export function Flag(props: FlagProps) {
  const { tone = "accent", className: cls = "" } = props;
  return <span className={`${flagClass(tone)} ${cls}`}>{props.children}</span>;
}
