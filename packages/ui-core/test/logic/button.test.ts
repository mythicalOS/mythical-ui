// test/logic/button.test.ts — ported from mythical-skuld's packages/preact-ui/ (component-derive.test.ts's
// buttonClass block, asserted there against the package export after the skuld-s5 U19 swap), repointed
// to import from the new ui-core logic module.

import { describe, expect, test } from "bun:test";
import { buttonClass } from "../../src/logic/button.ts";

describe("buttonClass", () => {
  test("variant + base", () => {
    expect(buttonClass("pri")).toBe("btn btn--pri");
    expect(buttonClass("dan")).toBe("btn btn--dan");
  });
  test("small adds modifier", () => {
    expect(buttonClass("sec", { small: true })).toContain("btn--sm");
  });
  test("loading and disabled both mark inert", () => {
    expect(buttonClass("acc", { loading: true })).toContain("is-disabled");
    expect(buttonClass("acc", { disabled: true })).toContain("is-disabled");
  });
});
