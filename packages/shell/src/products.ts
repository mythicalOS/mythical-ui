// @mythicalos/shell — the family product registry.
//
// The single source of truth for "what products exist in the mythical family".
// The <ProductSwitcher> renders this list; every product shows the same menu.
// Adding a product to the family = adding one entry here. Nothing else changes.
//
// `href` is where the switcher navigates. In a real deployment these are the
// per-product URLs (e.g. https://brokkr.internal, or a path behind one gateway).
// Set to null for a product that is listed but not yet navigable.
//
// `state` drives the trailing status dot:
//   'here'    — the product you're in now (accent dot, "here" badge)
//   'online'  — reachable (ok dot)
//   'soon'    — planned, not built (muted dot, click shows a "not built" note)
//
// Ported verbatim from design-export's mythical-ui/src/products.js — content is the
// product-approved registry and is kept EXACTLY as the export (name/key/initial/role/
// href/state for every entry), only the file gains a TS type.

export type ProductState = "here" | "online" | "soon";

export interface Product {
  key: string;
  name: string;
  initial: string;
  role: string;
  href: string | null;
  state: ProductState;
}

export const PRODUCTS: Product[] = [
  {
    key: "brokkr",
    name: "BROKKR",
    initial: "B",
    role: "Agent control room",
    href: "/brokkr",
    state: "online",
  },
  {
    key: "skuld",
    name: "SKULD",
    initial: "S",
    role: "Scheduler & fate ledger",
    href: "/skuld",
    state: "online",
  },
  {
    key: "saga",
    name: "SAGA",
    initial: "G",
    role: "Chronicle & session history",
    href: null,
    state: "soon",
  },
  {
    key: "edda",
    name: "EDDA",
    initial: "E",
    role: "Lore & knowledge base",
    href: null,
    state: "soon",
  },
];

// ASGARD — the command center that spans the family — is intentionally NOT in
// PRODUCTS yet. It is surfaced as a footer note in the switcher until it ships.
export const FAMILY_NOTE =
  "ASGARD — the command center that spans the family — arrives later.";
