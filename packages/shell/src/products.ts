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
//   'soon'    — planned, not built (muted dot, click routes to `onUnbuilt`)
//
// `role` is the product's own, context-free one-liner. The "· this container" suffix the design
// source shows on the current product is NOT stored here: it is a property of "the product you
// are in", not of any one product, so the switcher derives it at render time (see
// CURRENT_ROLE_SUFFIX in ProductSwitcher.tsx). Baking it into a registry that every product in
// the family renders would make it read false in all the other products' menus.
//
// Ported from the original design export; maintained here as the product-approved
// registry (name/key/initial/role/href/state for every entry).

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
    href: "/saga",
    state: "online",
  },
];

// ASGARD is the family's cross-product command center. It is deliberately NOT a member of
// PRODUCTS: the design source renders it below the product list, under its own "command center"
// section, and it is not one of the peer products a `current` key can ever point at from this
// package (it gets its own React shell). The switcher renders this entry in that section.
//
// HONESTY DEVIATION, deliberate and non-negotiable: the design source gives this row an "online"
// dot and a real navigation target. ASGARD is not built. This package never renders a state it
// has not proven, so the row ships `state: "soon"` (not-yet-built dot) and a null href, which
// routes a click through the same `onUnbuilt` path any unbuilt product uses — never a fake
// navigation. Structure from the design, truth from reality. Flip these two fields (and only
// these two) on the day ASGARD ships.
export const ASGARD: Product = {
  key: "asgard",
  name: "ASGARD",
  initial: "A",
  role: "Cross-family command center",
  href: null,
  state: "soon",
};

/**
 * @deprecated The switcher no longer renders a prose footer note — ASGARD now has a real row in
 * the panel's "command center" section (see ASGARD above), matching the design source, and that
 * row's secondary line defaults to `ASGARD.role`. This string is retained (not removed) because
 * it is a public export of a published package: dropping it would break any consumer that
 * imports it, for no benefit. It is still accepted by `<ProductSwitcher note={…}>` and is
 * equally usable as ready-made copy for a product's own `onUnbuilt` toast.
 */
export const FAMILY_NOTE =
  "ASGARD — the command center that spans the family — arrives later.";
