// test/logic/seg.test.ts — class derivation and the count contract for the tab segments
// (ds/components-seg).

import { describe, expect, test } from "bun:test";
import { SEG_PARTS, segClass, segCountText, segOptionClass } from "../../src/logic/seg.ts";

describe("segClass", () => {
  test("base, and the grow stretch", () => {
    expect(segClass()).toBe("my-seg");
    expect(segClass({})).toBe("my-seg");
    expect(segClass({ grow: true })).toBe("my-seg my-seg--grow");
  });

  test("only a real `true` grows — a truthy non-boolean does not", () => {
    expect(segClass({ grow: 1 as unknown as boolean })).toBe("my-seg");
    expect(segClass(null as never)).toBe("my-seg");
  });
});

describe("segOptionClass", () => {
  test("base, and the is-on selection", () => {
    expect(segOptionClass()).toBe("my-seg__opt");
    expect(segOptionClass({ selected: false })).toBe("my-seg__opt");
    expect(segOptionClass({ selected: true })).toBe("my-seg__opt is-on");
  });

  test("only a real `true` selects — a truthy non-boolean does not claim a selection", () => {
    // Same contract as chipDropdownClass: a claimed selection must be a decided one.
    expect(segOptionClass({ selected: 1 as unknown as boolean })).toBe("my-seg__opt");
    expect(segOptionClass(null as never)).toBe("my-seg__opt");
  });
});

describe("segCountText — the chipCountText contract", () => {
  test("a real, non-negative integer renders; zero IS a count", () => {
    expect(segCountText(3)).toBe("3");
    expect(segCountText(0)).toBe("0");
    expect(segCountText(-0)).toBe("0");
  });

  test("everything that is not a count renders nothing", () => {
    // A fraction cannot be a number of runs and a negative cannot be a number of anything —
    // malformed data must not render as a count the caller never measured.
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, -1, 1.5, "12", "", {}, []]) {
      expect({ bad, text: segCountText(bad) }).toEqual({ bad, text: null });
    }
  });
});

describe("the parts map", () => {
  test("every class the bindings render is declared once, here", () => {
    expect(SEG_PARTS).toEqual({
      root: "my-seg",
      opt: "my-seg__opt",
      count: "my-seg__count",
    });
  });
});
