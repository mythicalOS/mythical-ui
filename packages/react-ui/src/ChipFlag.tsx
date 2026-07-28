// @mythicalos/react-ui — ChipFlag: the squared, mono member of the design system's Chip card (v2).
// React twin of packages/preact-ui/src/ChipFlag.tsx.
//
// It carries MACHINE facts — kinds, counters, diff letters — where Chip carries human labels.
// Non-interactive, like Chip; only ChipDropdown is clickable. The card's rule for tones: flags are
// honest counters, never decoration — warn-soft for behind/uncommitted, error-soft ONLY for
// something that can be lost, ok-soft for a clean tree. The uppercase reading of the card's
// examples is the CALLER's text, not a `text-transform` here: forcing case would silently rewrite
// a case-sensitive machine fact (a diff letter, a ref name).

import type { ReactNode } from "react";
import { chipFlagClass, type ChipFlagTone } from "@mythicalos/ui-core/logic";

export {
  chipFlagClass,
  CHIP_FLAG_TONES,
  CHIP_FLAG_PARTS,
  type ChipFlagTone,
} from "@mythicalos/ui-core/logic";

export interface ChipFlagProps {
  /** `accent` (the default) is the base rule and emits no modifier. */
  tone?: ChipFlagTone;
  className?: string;
  /** REQUIRED. A flag is an honest counter, never decoration: a tone with no machine fact
   *  beside it is colour alone, which token rule #7 and the card's do/don't panel both ban. */
  children: ReactNode;
}

export function ChipFlag(props: ChipFlagProps) {
  const { tone = "accent", className: cls = "" } = props;
  return <span className={`${chipFlagClass(tone)} ${cls}`}>{props.children}</span>;
}
