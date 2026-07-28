// @mythicalos/react-ui — ChipDropdown: the ONE interactive member of the design system's Chip
// card (v2). React twin of packages/preact-ui/src/ChipDropdown.tsx.
//
// Squared control radius + --my-control-border + a hover invite, which under canonical token
// rule #10 is exactly what marks it as clickable where Chip and ChipFlag are not.
//
// v2 changed nothing about this component's behaviour. Its root class moved from `.my-chipdd` to
// `.my-chip-dd` (and its elements with it), which the core owns — this file never spells them.
//
// Two deliberate deviations from the card's static markup, both toward the platform:
//   - it renders a real <button type="button">, not a `<span role="button" tabindex="0">`. The
//     span form is a polyfill for a button; this package's other chip-shaped control (the popover
//     trigger) is already a real button, and a button gets keyboard activation and focus for free
//     rather than through hand-rolled key handling that can silently rot.
//   - `disabled` renders `aria-disabled="true"` (the card's own selector) rather than the native
//     `disabled` attribute. That keeps the chip focusable and announced as disabled instead of
//     silently vanishing from the tab order — the reason aria-disabled exists. The cost is that
//     the platform still dispatches a click on activation, so the core's `chipDropdownActivate`
//     SUPPRESSES it (preventDefault + stopPropagation) rather than merely declining to handle it:
//     a disabled chip inside a clickable row must not activate the row. The stylesheet paints both
//     spellings, so a consumer who prefers a natively disabled button gets the same look.
//
// SCOPE: this atom is the chip CONTROL only. It owns no menu, so it asserts no `aria-haspopup` or
// `aria-expanded` — claiming a popup this component does not manage would be a promise the markup
// cannot keep. A consumer wiring it to a real menu should reach for `Popover`, which owns that
// contract end to end.

import type { MouseEvent } from "react";
import {
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_PARTS,
  chipDropdownActivate,
  chipDropdownClass,
  chipDropdownValueText,
} from "@mythicalos/ui-core/logic";

export {
  chipDropdownActivate,
  chipDropdownClass,
  chipDropdownValueText,
  CHIP_DROPDOWN_PARTS,
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  type ChipDropdownState,
  type ChipDropdownActivation,
} from "@mythicalos/ui-core/logic";

export interface ChipDropdownProps {
  /** Static prefix, e.g. `"model"`. Omit for a value-only chip. */
  label?: string;
  /** The current value. Absent or blank renders the honest `—`, never an empty slot that reads
   *  as a value which failed to load. */
  value?: string;
  /** The card's `.sel` — this chip carries the current selection. */
  selected?: boolean;
  /** Announced via `aria-disabled`. The chip stays focusable, and its activation is suppressed
   *  at the event — it never reaches `onClick`, and it never bubbles to an ancestor. */
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ChipDropdown(props: ChipDropdownProps) {
  const { label, value, selected = false, disabled = false, onClick, className: cls = "" } = props;
  return (
    <button
      type="button"
      className={`${chipDropdownClass({ selected })} ${cls}`}
      aria-disabled={disabled ? "true" : undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (chipDropdownActivate(event, { disabled })) onClick?.();
      }}
    >
      {label !== undefined ? label : null}
      <span className={CHIP_DROPDOWN_PARTS.value}>{chipDropdownValueText(value)}</span>
      <span className={CHIP_DROPDOWN_PARTS.caret} aria-hidden="true">
        {CHIP_DROPDOWN_CARET}
      </span>
    </button>
  );
}
