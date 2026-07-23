// packages/shell/products.test.ts — the family product registry (Task 8). PRODUCTS is the single
// source of truth <ProductSwitcher> renders from; these assertions pin its exact content (keys,
// names, states, hrefs) so an accidental edit — a typo'd key, a flipped state, a dropped product —
// fails loudly rather than silently changing what every product's switcher shows.

import { describe, expect, test } from "bun:test";
import { FAMILY_NOTE, PRODUCTS } from "./src/index.ts";

describe("PRODUCTS — exact registry content (ported verbatim from design-export)", () => {
  test("exactly 4 products, in the export's order", () => {
    expect(PRODUCTS.map((p) => p.key)).toEqual(["brokkr", "skuld", "saga", "edda"]);
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

  test("saga — soon, not yet navigable (null href)", () => {
    expect(PRODUCTS[2]).toEqual({
      key: "saga",
      name: "SAGA",
      initial: "G",
      role: "Chronicle & session history",
      href: null,
      state: "soon",
    });
  });

  test("edda — soon, not yet navigable (null href)", () => {
    expect(PRODUCTS[3]).toEqual({
      key: "edda",
      name: "EDDA",
      initial: "E",
      role: "Lore & knowledge base",
      href: null,
      state: "soon",
    });
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

describe("FAMILY_NOTE — the ASGARD footer note", () => {
  test("matches the export's copy exactly", () => {
    expect(FAMILY_NOTE).toBe("ASGARD — the command center that spans the family — arrives later.");
  });

  test("ASGARD is intentionally absent from PRODUCTS itself", () => {
    expect(PRODUCTS.some((p) => p.key === "asgard" || p.name === "ASGARD")).toBe(false);
  });
});
