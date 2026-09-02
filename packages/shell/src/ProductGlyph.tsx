/** @jsxImportSource preact */
// @mythicalos/shell — the family product glyphs, as used by the product navigation.
//
// These are the design system's product marks in their SMALL-SIZE tunings (ink strokes 7,
// accent rings 6, dots one radius up — optically weighted for ~20px display). Colors come
// from tokens (var(--my-ink) / var(--my-accent)), so they theme automatically, same as Logo.
//
// The registry is keyed by product key; a key without registered art renders nothing so the
// caller can fall back to the product's initial (custom product lists stay supported).

import type { JSX } from "preact";

const INK = "var(--my-ink)";
const ACC = "var(--my-accent)";

const ART: Record<string, () => JSX.Element> = {
  brokkr: () => (
    <>
      <g fill={INK} transform="rotate(-35 48 48)">
        <rect x="28" y="24" width="34" height="17" rx="4" />
        <rect x="42" y="41" width="8" height="36" rx="4" />
      </g>
      <circle cx="74" cy="26" r="5" fill={ACC} />
      <circle cx="62" cy="14" r="4" fill={ACC} />
      <circle cx="82" cy="44" r="6" fill="none" stroke={ACC} stroke-width="6" />
    </>
  ),
  skuld: () => (
    <>
      <g fill="none" stroke={INK} stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 24c26 0 34 20 46 23" />
        <path d="M10 48h46" />
        <path d="M10 72c26 0 34-20 46-23" />
        <path d="M67 48h13" />
      </g>
      <circle cx="61" cy="48" r="8" fill={ACC} />
      <circle cx="86" cy="48" r="6" fill="none" stroke={ACC} stroke-width="6" />
    </>
  ),
  saga: () => (
    <>
      <g fill="none" stroke={INK} stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="44" cy="22" rx="26" ry="9" />
        <path d="M18 22v40" />
        <path d="M70 22v40" />
        <path d="M18 62a26 9 0 0 0 52 0" />
        <path d="M18 42a26 9 0 0 0 52 0" />
        <path d="M75 52h8" />
      </g>
      <circle cx="70" cy="52" r="6" fill={ACC} />
      <circle cx="88" cy="52" r="5" fill="none" stroke={ACC} stroke-width="6" />
    </>
  ),
  asgard: () => (
    <>
      <g fill="none" stroke={INK} stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 53C12 17 84 17 84 53" />
        <path d="M25 61v-17" />
        <path d="M48 65V26" />
        <path d="M71 61v-17" />
      </g>
      <circle cx="25" cy="65" r="5" fill={ACC} />
      <circle cx="48" cy="69" r="5" fill={ACC} />
      <circle cx="71" cy="65" r="5" fill={ACC} />
    </>
  ),
};

/** True iff `productKey` has registered glyph art. */
export function hasProductGlyph(productKey: string): boolean {
  return productKey in ART;
}

export interface ProductGlyphProps {
  productKey: string;
  size?: number;
}

/** The product's glyph mark, or null for a key without registered art (callers fall back to
 *  the product's initial letter). */
export function ProductGlyph({ productKey, size = 20 }: ProductGlyphProps) {
  const art = ART[productKey];
  if (!art) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" class="my-glyph">
      {art()}
    </svg>
  );
}
