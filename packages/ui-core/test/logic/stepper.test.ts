// test/logic/stepper.test.ts — class derivation, badge glyph and the todo/current/done walk for
// the wizard stepper (ds/components-stepper, the mockup gap wave). The state vocabulary is
// ENUMERATED from the exported constant rather than restated, per the chip-family precedent.

import { describe, expect, test } from "bun:test";
import {
  STEPPER_PARTS,
  STEP_DONE_GLYPH,
  STEP_STATES,
  stepBadge,
  stepClass,
  stepperClass,
  stepState,
  type StepState,
} from "../../src/logic/stepper.ts";

describe("stepperClass", () => {
  test("base, and the one size step", () => {
    expect(stepperClass()).toBe("my-stepper");
    expect(stepperClass("sm")).toBe("my-stepper my-stepper--sm");
  });

  test("anything that is not the size step is the default", () => {
    expect(stepperClass(undefined)).toBe("my-stepper");
    expect(stepperClass("md" as never)).toBe("my-stepper");
  });
});

describe("stepClass", () => {
  test("todo is the DEFAULT and emits no modifier (the base rule already paints it)", () => {
    expect(stepClass()).toBe("my-stepper__step");
    expect(stepClass("todo")).toBe("my-stepper__step");
  });

  test("current and done add exactly one modifier each", () => {
    expect(stepClass("current")).toBe("my-stepper__step my-stepper__step--current");
    expect(stepClass("done")).toBe("my-stepper__step my-stepper__step--done");
  });

  test("the state vocabulary is exactly the walk, in order", () => {
    expect([...STEP_STATES]).toEqual(["todo", "current", "done"]);
    for (const state of STEP_STATES) expect(stepClass(state).startsWith("my-stepper__step")).toBe(true);
  });

  test("an unknown state degrades to the base instead of emitting a rule-less modifier", () => {
    expect(stepClass("active" as StepState)).toBe("my-stepper__step");
    expect(stepClass(undefined as unknown as StepState)).toBe("my-stepper__step");
    expect(stepClass(null as unknown as StepState)).toBe("my-stepper__step");
  });
});

describe("stepBadge", () => {
  test("done shows the glyph, everything else the number", () => {
    expect(STEP_DONE_GLYPH).toBe("✓");
    expect(stepBadge(2, "done")).toBe(STEP_DONE_GLYPH);
    expect(stepBadge(2, "current")).toBe("2");
    expect(stepBadge(3, "todo")).toBe("3");
  });
});

describe("stepState — the 1-based walk", () => {
  test("earlier steps are done, the match is current, later ones todo", () => {
    expect(stepState(1, 2)).toBe("done");
    expect(stepState(2, 2)).toBe("current");
    expect(stepState(3, 2)).toBe("todo");
  });

  test("current = 1 marks nothing done", () => {
    expect(stepState(1, 1)).toBe("current");
    expect(stepState(2, 1)).toBe("todo");
  });

  test("a non-finite current marks nothing current and nothing done", () => {
    // An unloaded view-model can hand NaN where the type says number; every step reading as done
    // would claim progress the caller never reported.
    for (const n of [1, 2, 3]) expect(stepState(n, NaN)).toBe("todo");
  });
});

describe("the parts map", () => {
  test("every class the bindings render is declared once, here", () => {
    expect(STEPPER_PARTS).toEqual({
      root: "my-stepper",
      step: "my-stepper__step",
      dot: "my-stepper__dot",
      bar: "my-stepper__bar",
    });
  });
});
