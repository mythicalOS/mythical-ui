// packages/shell/products.test.ts — the family product registry. PRODUCTS is the single
// source of truth <ProductSwitcher> renders from; these assertions pin its exact content (keys,
// names, states, hrefs) so an accidental edit — a typo'd key, a flipped state, a dropped product —
// fails loudly rather than silently changing what every product's switcher shows.

import { describe, expect, test } from "bun:test";
import { ASGARD, FAMILY_NOTE, PRODUCTS } from "./src/index.ts";

describe("PRODUCTS — exact registry content", () => {
  test("exactly 3 products, in registry order", () => {
    expect(PRODUCTS.map((p) => p.key)).toEqual(["brokkr", "skuld", "saga"]);
  });

  test("brokkr — online, navigable", () => {
    expect(PRODUCTS[0]).toEqual({
      key: "brokkr",
      name: "BROKKR",
      initial: "B",
      role: "Agent control room",
      href: "/brokkr",
      state: "online",
    });
  });

  test("skuld — online, navigable", () => {
    expect(PRODUCTS[1]).toEqual({
      key: "skuld",
      name: "SKULD",
      initial: "S",
      role: "Scheduler & fate ledger",
      href: "/skuld",
      state: "online",
    });
  });

  test("saga — online, navigable (it ships and runs; a 'soon' state would short-circuit the consumer's live probe into a false 'not built yet')", () => {
    expect(PRODUCTS[2]).toEqual({
      key: "saga",
      name: "SAGA",
      initial: "G",
      role: "Chronicle & session history",
      href: "/saga",
      state: "online",
    });
  });

  test("every shipped product is online with a placeholder href in the same /<key> shape", () => {
    for (const p of PRODUCTS) {
      expect(p.state).toBe("online");
      expect(p.href).toBe(`/${p.key}`);
    }
  });

  test("no role carries the current-product suffix — that is derived at render time from `current`", () => {
    for (const p of PRODUCTS) expect(p.role).not.toContain("this container");
  });

  test("every 'soon' product has a null href, and every 'online' product has a non-null href", () => {
    for (const p of PRODUCTS) {
      if (p.state === "soon") expect(p.href).toBeNull();
      if (p.state === "online") expect(p.href).not.toBeNull();
    }
  });

  test("no product pre-declares state='here' — that badge is always derived at render time from `current`", () => {
    for (const p of PRODUCTS) expect(p.state).not.toBe("here");
  });

  test("every key/initial is unique", () => {
    expect(new Set(PRODUCTS.map((p) => p.key)).size).toBe(PRODUCTS.length);
    expect(new Set(PRODUCTS.map((p) => p.initial)).size).toBe(PRODUCTS.length);
  });
});

describe("ASGARD — the command-center entry", () => {
  test("matches the design source's copy exactly", () => {
    expect(ASGARD.key).toBe("asgard");
    expect(ASGARD.name).toBe("ASGARD");
    expect(ASGARD.role).toBe("Cross-family command center");
  });

  test("honesty deviation: not built, so it carries the not-yet-built state and no href — the design source's 'online' dot and real link are deliberately NOT copied", () => {
    expect(ASGARD.state).toBe("soon");
    expect(ASGARD.href).toBeNull();
  });

  test("is not a member of PRODUCTS — it renders in its own command-center section", () => {
    expect(PRODUCTS.some((p) => p.key === "asgard" || p.name === "ASGARD")).toBe(false);
  });
});

describe("FAMILY_NOTE — retained for compatibility", () => {
  test("still exported with its original copy (removing a published export would break consumers)", () => {
    expect(FAMILY_NOTE).toBe("ASGARD — the command center that spans the family — arrives later.");
  });
});
