/** @jsxImportSource preact */
// @mythicalos/shell — ProductSwitcher, the flagship central module.
//
// The logo IS the switcher trigger. Clicking it opens the family panel listing every product
// from the shared registry. This is the single component that makes BROKKR / SKULD / SAGA / EDDA
// feel like one product — it lives here so all of them render the exact same menu.
//
// Ported from design-export's mythical-ui/src/components/ProductSwitcher.jsx (JSX→TSX, typed
// props), behavior preserved exactly: outside-click + Escape close the panel, and the panel is
// role="menu" with role="menuitem" entries.
//
// Task 8 testability note: preact-render-to-string never runs effects or dispatches DOM events,
// so the export's original shape (one stateful component owning both the open/close toggle AND
// the click-routing decision in an inline closure) can't be exercised past its closed-trigger
// render from a render-to-string test alone. Two pieces are pulled out as plain, hook-free
// functions so the panel markup and the routing decision are independently testable without a
// DOM: `SwitcherPanel` (unconditional render of the open panel — not part of the package's public
// barrel, but exported from this module for direct test import) and `resolveSwitcherPick` (the
// pure onNavigate/onUnbuilt decision, mirroring the export's inline `pick` closure exactly). The
// outside-click/Escape *wiring itself* (document mousedown/keydown listeners) still requires a
// real DOM to execute; see product-switcher.test.tsx for the source-scan that verifies the
// wiring is present, and the report for the full depth discussion.

import { useEffect, useRef, useState } from "preact/hooks";
import { Logo } from "./Logo.js";
import { PRODUCTS, FAMILY_NOTE, type Product, type ProductState } from "./products.js";

export interface ProductSwitcherProps {
  /** key of the product you're in (e.g. 'brokkr'); gets the "here" badge. */
  current: string;
  /** registry list. Defaults to the shared PRODUCTS. */
  products?: Product[];
  /** footer note. Defaults to the ASGARD note. */
  note?: string;
  /** (product) => void. Defaults to setting window.location to product.href. A product using a
   * client router passes its own navigate here. */
  onNavigate?: (product: Product) => void;
  /** (product) => void, called when a 'soon' (or href-less) product is clicked. */
  onUnbuilt?: (product: Product) => void;
}

const DOT_CLASS: Record<ProductState, string> = {
  here: "my-switcher__dot--here",
  online: "my-switcher__dot--online",
  soon: "my-switcher__dot--soon",
};

export interface ResolveSwitcherPickHandlers {
  onNavigate?: (product: Product) => void;
  onUnbuilt?: (product: Product) => void;
}

export type SwitcherPickResult =
  | { action: "noop" }
  | { action: "unbuilt" }
  | { action: "navigate-handled" }
  | { action: "navigate-href"; href: string };

/**
 * The pure click-routing decision (mirrors the export's inline `pick` closure): clicking the
 * current product is a no-op; a 'soon' or href-less product calls `onUnbuilt`; anything else
 * calls the caller-supplied `onNavigate` if given, otherwise reports the href for the caller to
 * assign to `window.location.href` (kept out of this function so it stays DOM-free and testable).
 */
export function resolveSwitcherPick(
  product: Product,
  current: string,
  handlers: ResolveSwitcherPickHandlers,
): SwitcherPickResult {
  if (product.key === current) return { action: "noop" };
  if (product.state === "soon" || !product.href) {
    handlers.onUnbuilt?.(product);
    return { action: "unbuilt" };
  }
  if (handlers.onNavigate) {
    handlers.onNavigate(product);
    return { action: "navigate-handled" };
  }
  return { action: "navigate-href", href: product.href };
}

export interface SwitcherPanelProps {
  current: string;
  products: Product[];
  note: string;
  onPick: (product: Product) => void;
}

/**
 * The open panel's markup, unconditionally rendered (no hooks) — split out of `ProductSwitcher`
 * purely so it can be rendered directly in tests without needing to drive the trigger's internal
 * open state through a DOM click.
 */
export function SwitcherPanel({ current, products, note, onPick }: SwitcherPanelProps) {
  return (
    <div class="my-switcher__panel" role="menu">
      <div class="my-switcher__heading">mythical family</div>
      {products.map((p) => {
        const isCurrent = p.key === current;
        const state: ProductState = isCurrent ? "here" : p.state;
        return (
          <button
            key={p.key}
            class={"my-switcher__item" + (isCurrent ? " is-current" : "")}
            role="menuitem"
            onClick={() => onPick(p)}
          >
            <span class="my-switcher__mark">{p.initial}</span>
            <span class="my-switcher__body">
              <span class="my-switcher__name">
                {p.name}
                {isCurrent && <span class="my-switcher__here">here</span>}
              </span>
              <span class="my-switcher__role">{p.role}</span>
            </span>
            <span class={"my-switcher__dot " + DOT_CLASS[state]} title={state} />
          </button>
        );
      })}
      <div class="my-switcher__divider" />
      <div class="my-switcher__note">
        <span class="my-switcher__note-glyph">✦</span>
        <span>{note}</span>
      </div>
    </div>
  );
}

export function ProductSwitcher({
  current,
  products = PRODUCTS,
  note = FAMILY_NOTE,
  onNavigate,
  onUnbuilt,
}: ProductSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentProduct = products.find((p) => p.key === current);

  const pick = (p: Product) => {
    setOpen(false);
    const result = resolveSwitcherPick(p, current, { onNavigate, onUnbuilt });
    if (result.action === "navigate-href") window.location.href = result.href;
  };

  return (
    <div class="my-switcher" ref={ref}>
      <button
        class="my-switcher__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Switch product"
        onClick={() => setOpen((o) => !o)}
      >
        <Logo product={currentProduct ? currentProduct.name.toLowerCase() : ""} />
        <span class="my-switcher__chevron">⌄</span>
      </button>

      {open && <SwitcherPanel current={current} products={products} note={note} onPick={pick} />}
    </div>
  );
}
