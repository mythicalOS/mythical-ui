/** @jsxImportSource preact */
// @mythicalos/shell — the family mark + two-line wordmark. Shared by every product; the mark is
// the product you are in, the wordmark's second line names it. Colors come from tokens
// (var(--my-*)), so it themes automatically.
//
// Mark: the design source renders the CURRENT PRODUCT's glyph in every logo slot (top bar, auth
// screen, setup-wizard header) at 30×30 — the family convention is "the mark is the product you
// are in", and the product glyphs already live in ProductGlyph.tsx. `Logo` therefore renders
// <ProductGlyph> for the resolved product key. A key with no registered art falls back to
// `LogoMark` (the generic family mark) so the slot is never empty — a hole in the top bar is
// worse than a generic mark.

import { ProductGlyph, hasProductGlyph } from "./ProductGlyph.js";

export interface LogoMarkProps {
  size?: number;
}

/**
 * The generic family mark (the branching "M" with petrol nodes). No longer the default mark —
 * `Logo` renders the current product's glyph — but kept exported: it is the fallback for a
 * product key without registered art, and removing a public export of a published package would
 * break any consumer that renders it directly.
 */
export function LogoMark({ size = 34 }: LogoMarkProps) {
  return (
    <span class="my-logo__mark" aria-hidden="true">
      <svg width={size} viewBox="30 50 196 176">
        <path
          d="M48 204V72L128 152L208 72V168"
          fill="none"
          stroke="var(--my-ink)"
          stroke-width="18"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <circle cx="48" cy="72" r="13" fill="var(--my-accent)" stroke="var(--my-surface)" stroke-width="5" />
        <circle cx="128" cy="152" r="13" fill="var(--my-accent)" stroke="var(--my-surface)" stroke-width="5" />
        <circle cx="208" cy="72" r="13" fill="var(--my-accent)" stroke="var(--my-surface)" stroke-width="5" />
        <circle cx="208" cy="186" r="9" fill="none" stroke="var(--my-accent)" stroke-width="6.5" />
        <circle cx="208" cy="209" r="12" fill="none" stroke="var(--my-accent)" stroke-width="6.5" />
      </svg>
    </span>
  );
}

export interface LogoProps {
  /** The per-product line rendered under "mythical" (e.g. "brokkr", "skuld", …). Also selects the
   *  mark's glyph unless `productKey` is given. */
  product?: string;
  /** Registry key of the product whose glyph the mark shows (e.g. 'brokkr'). Defaults to
   *  `product` — which is already the product key for every family product, whose wordmark line
   *  is its lowercased name. Pass it explicitly when a product's display line and its registry
   *  key differ. */
  productKey?: string;
  /** Mark size in px. 30 is the design source's logo-slot size. */
  size?: number;
}

/** The two-line wordmark: "mythical●" over the product name, marked by the product's glyph. */
export function Logo({ product, productKey, size = 30 }: LogoProps) {
  // Case-folded so a display-cased product line ("BROKKR") still resolves its glyph; every
  // registered key is lowercase.
  const key = (productKey ?? product ?? "").toLowerCase();
  return (
    <span class="my-logo">
      {hasProductGlyph(key) ? (
        <span class="my-logo__mark" aria-hidden="true">
          <ProductGlyph productKey={key} size={size} />
        </span>
      ) : (
        <LogoMark size={size} />
      )}
      <span class="my-logo__word">
        <span class="my-logo__family">mythical</span>
        <span class="my-logo__product">{product}</span>
      </span>
    </span>
  );
}
