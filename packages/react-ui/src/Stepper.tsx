// @mythicalos/react-ui — wizard stepper (ds/components-stepper): todo/current/done rows with
// numbered dots, ported upstream from the product mockups' four hand-rolled variants. React twin
// of packages/preact-ui/src/Stepper.tsx. Every derivation (state walk, class strings, badge
// glyph) lives in `@mythicalos/ui-core` — this binding only renders. Clickability rides the
// ELEMENT: a step renders as a real <button> ONLY when the caller passes `onSelect` for it (the
// pages allow back-nav, i <= current), a plain <span> otherwise — so a non-navigable step can
// never look or announce like a control. The connector bar is opt-in (`bars`): the page-level
// steppers draw it, card-head dot rows do not.

import { Fragment } from "react";
import {
  STEPPER_PARTS,
  STEP_DONE_GLYPH,
  stepBadge,
  stepClass,
  stepperClass,
  stepState,
  type StepState,
} from "@mythicalos/ui-core/logic";

export { STEPPER_PARTS, STEP_DONE_GLYPH, stepBadge, stepClass, stepperClass, stepState, type StepState };

export interface StepperStep {
  label: string;
  /** Activates the step. The step renders as a <button> ONLY when this is present. */
  onSelect?: () => void;
}

export interface StepperProps {
  /** The steps, in order. Badges are 1-based — the pages' own numbering. */
  steps: readonly StepperStep[];
  /** 1-based number of the CURRENT step; earlier steps render done, later ones todo. */
  current: number;
  size?: "sm";
  /** Draw the connector bar between steps. */
  bars?: boolean;
  className?: string;
}

export function Stepper(props: StepperProps) {
  const { size, bars = false, className: cls = "" } = props;
  // A JS caller can hand a non-array where the type says `StepperStep[]`; render an empty row
  // rather than crashing on `.map` (the StatTiles precedent).
  const steps = Array.isArray(props.steps) ? props.steps : [];
  return (
    <div className={`${stepperClass(size)} ${cls}`}>
      {steps.map((step, i) => {
        const n = i + 1;
        const state = stepState(n, props.current);
        const ariaCurrent = state === "current" ? ("step" as const) : undefined;
        // The dot repeats what the label + aria-current already say, so it is decoration.
        const dot = (
          <span className={STEPPER_PARTS.dot} aria-hidden="true">
            {stepBadge(n, state)}
          </span>
        );
        return (
          <Fragment key={`${i}:${step.label}`}>
            {i > 0 && bars ? <span className={STEPPER_PARTS.bar} aria-hidden="true" /> : null}
            {step.onSelect ? (
              <button type="button" className={stepClass(state)} aria-current={ariaCurrent} onClick={step.onSelect}>
                {dot}
                {step.label}
              </button>
            ) : (
              <span className={stepClass(state)} aria-current={ariaCurrent}>
                {dot}
                {step.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
