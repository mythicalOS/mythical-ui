/** @jsxImportSource preact */
// @mythicalos/shell — ProductSwitcher, the flagship central module.
//
// The logo IS the switcher trigger. Clicking it opens the family panel listing every product
// from the shared registry, then a "command center" section holding ASGARD. This is the single
// component that makes every product in the family feel like one product — it lives here so all
// of them render the exact same menu.
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
import { ProductGlyph, hasProductGlyph } from "./ProductGlyph.js";
import { ASGARD, PRODUCTS, type Product, type ProductState } from "./products.js";

export interface ProductSwitcherProps {
  /** key of the product you're in (e.g. 'brokkr'); gets the "here" badge. */
  current: string;
  /** registry list. Defaults to the shared PRODUCTS. */
  products?: Product[];
  /** Secondary line of the "command center" (ASGARD) row. Defaults to `ASGARD.role`. Was the
   * prose footer note this panel used to render below the products; the design source replaced
   * that note with a real ASGARD row, so the prop now feeds that row's role line — the closest
   * surviving slot, kept rather than dropped so no consumer's value is silently discarded. */
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

/**
 * Appended to the role line of the row for the product you are currently in, matching the design
 * source ("Agent control room · this container"). Derived at render time rather than stored in
 * the registry: it describes "the product you're in", not any one product, so it must follow
 * `current` — otherwise every other product's menu would claim this one is their container.
 * Exported for tests; not part of the package's public barrel.
 */
export const CURRENT_ROLE_SUFFIX = " · this container";

/** The panel's section label above the command-center row (design source: "command center"). */
export const COMMAND_CENTER_LABEL = "command center";

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

interface SwitcherRowProps {
  product: Product;
  /** dot state for this row (the product's own, or "here" for the current one). */
  state: ProductState;
  /** role line as rendered — the product's role, plus CURRENT_ROLE_SUFFIX for the current row. */
  role: string;
  isCurrent: boolean;
  onPick: () => void;
}

/**
 * One row of the panel. The design source uses the identical markup shape for the product rows
 * and the command-center row, so both go through this — a divergence between them can't drift in.
 */
function SwitcherRow({ product, state, role, isCurrent, onPick }: SwitcherRowProps) {
  return (
    <button
      class={"my-switcher__item" + (isCurrent ? " is-current" : "")}
      role="menuitem"
      onClick={onPick}
    >
      <span class="my-switcher__mark">
        {hasProductGlyph(product.key) ? <ProductGlyph productKey={product.key} /> : product.initial}
      </span>
      <span class="my-switcher__body">
        <span class="my-switcher__name">
          {product.name}
          {isCurrent && <span class="my-switcher__here">here</span>}
        </span>
        <span class="my-switcher__role">{role}</span>
      </span>
      <span class={"my-switcher__dot " + DOT_CLASS[state]} title={state} />
    </button>
  );
}

export interface SwitcherPanelProps {
  current: string;
  products: Product[];
  /** the command-center row's role line (see ProductSwitcherProps.note). */
  note: string;
  onPick: (product: Product) => void;
}

/**
 * The open panel's markup, unconditionally rendered (no hooks) — split out of `ProductSwitcher`
 * purely so it can be rendered directly in tests without needing to drive the trigger's internal
 * open state through a DOM click.
 *
 * Structure follows the design source: the "mythical family" product rows, a divider, a
 * "command center" section label, then the ASGARD row. ASGARD's row deliberately does NOT copy
 * the design's online dot / real navigation target — see the honesty note on `ASGARD` in
 * products.ts: it renders the not-yet-built dot and routes clicks to `onUnbuilt`, because this
 * package never shows a state it has not proven.
 */
export function SwitcherPanel({ current, products, note, onPick }: SwitcherPanelProps) {
  return (
    <div class="my-switcher__panel" role="menu">
      <div class="my-switcher__heading">mythical family</div>
      {products.map((p) => {
        const isCurrent = p.key === current;
        return (
          <SwitcherRow
            key={p.key}
            product={p}
            state={isCurrent ? "here" : p.state}
            role={isCurrent ? p.role + CURRENT_ROLE_SUFFIX : p.role}
            isCurrent={isCurrent}
            onPick={() => onPick(p)}
          />
        );
      })}
      <div class="my-switcher__divider" />
      <div class="my-switcher__section">{COMMAND_CENTER_LABEL}</div>
      <SwitcherRow
        product={ASGARD}
        state={ASGARD.state}
        role={note}
        isCurrent={false}
        onPick={() => onPick(ASGARD)}
      />
    </div>
  );
}

export function ProductSwitcher({
  current,
  products = PRODUCTS,
  note = ASGARD.role,
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
        {/* the mark is the product you are in: `current` selects the glyph, the wordmark's
            second line stays the product's lowercased display name. */}
        <Logo
          productKey={current}
          product={currentProduct ? currentProduct.name.toLowerCase() : ""}
        />
        <span class="my-switcher__chevron">⌄</span>
      </button>

      {open && <SwitcherPanel current={current} products={products} note={note} onPick={pick} />}
    </div>
  );
}
