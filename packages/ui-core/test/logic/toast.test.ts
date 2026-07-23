// test/logic/toast.test.ts — ported from mythical-brokkr's ui/tests/modal-helpers.test.ts, the
// `composeToastText` describe block (the pure text-join helper's home test — mythical-skuld's own
// preact-ui package never had a dedicated composeToastText unit test, only this downstream consumer
// did). The doubled-prefix regression case is adapted to inline literals here instead of the
// product-specific `GOOD_NIGHT_TOAST_TITLE`/`GOOD_NIGHT_TOAST_BODY` constants, which belong to
// mythical-brokkr, not this framework-agnostic core.

import { describe, expect, test } from "bun:test";
import { composeToastText, TOAST_SEP } from "../../src/logic/toast.ts";

describe("composeToastText — the toast's visible title/body join", () => {
  test("title only → just the title (no trailing separator)", () => {
    expect(composeToastText("Spawned")).toBe("Spawned");
  });
  test("title + body → joined by the ` — ` separator", () => {
    expect(composeToastText("Delivery failed", "timeout")).toBe("Delivery failed — timeout");
  });
  test("the separator is exactly TOAST_SEP", () => {
    expect(composeToastText("A", "B")).toBe(`A${TOAST_SEP}B`);
  });
  test("a body must not itself repeat the title (the doubled-prefix regression)", () => {
    const title = "Good-night";
    const body = "team stopped.";
    expect(composeToastText(title, body)).toBe("Good-night — team stopped.");
    expect(body.toLowerCase()).not.toContain(title.toLowerCase());
  });
});
