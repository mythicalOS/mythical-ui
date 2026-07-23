/** @jsxImportSource preact */
// @mythicalos/shell — the mythical family mark + two-line wordmark. Shared by every product;
// only the wordmark's product line changes. Colors come from tokens (var(--my-*)), so it themes
// automatically.
//
// Ported from design-export's mythical-ui/src/components/Logo.jsx (JSX→TSX, typed props).

export interface LogoMarkProps {
  size?: number;
}

/** The branching "M" with petrol nodes. */
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
  /** The per-product line rendered under "mythical" (e.g. "brokkr", "skuld", …). */
  product?: string;
  size?: number;
}

/** The two-line wordmark: "mythical●" over the product name. */
export function Logo({ product, size = 34 }: LogoProps) {
  return (
    <span class="my-logo">
      <LogoMark size={size} />
      <span class="my-logo__word">
        <span class="my-logo__family">mythical</span>
        <span class="my-logo__product">{product}</span>
      </span>
    </span>
  );
}
