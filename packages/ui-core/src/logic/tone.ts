// @mythicalos/ui-core — tone axis and class derivation for status/banner + shared gauge/dialog
// tri-state (ds/tokens rule #4 and rule #7: status never relies on color alone — an icon/glyph
// always rides along). Both the Preact and React bindings import from here so they derive identical
// class strings from one source.
//
// `chipClass` / `ChipTone` USED to live here. The design system's v2 Chip card grew the atom a
// size axis, two more tones and three element variants, so the whole family — Chip, ChipFlag,
// ChipDropdown — now lives in ./chip.ts, and that module is its ONLY derivation. Nothing here
// re-derives a chip class: two spellings of the same class string is precisely the drift the
// consolidation removes.

export type Tone = "ok" | "warn" | "error";

// StatusLine tone (design-export/packages/preact-ui/src/components/Status.jsx): supports 6 tones.
// Class derivation: base "my-status" + always-present tone modifier.
export type StatusTone = "ok" | "warn" | "error" | "info" | "muted" | "accent";
export function statusLineClass(tone: StatusTone): string {
  return `my-status my-status--${tone}`;
}

// Banner tone + glyph map (design-export/packages/preact-ui/src/components/Banner.jsx): 4 tones,
// each with a required glyph (token rule #7: status softs never rely on color alone).
export type BannerTone = "warn" | "info" | "ok" | "error";
export const BANNER_ICON: Record<BannerTone, string> = {
  warn: "▲",
  info: "ℹ",
  ok: "✓",
  error: "✕",
};
export function bannerClass(tone: BannerTone): string {
  return `my-banner my-banner--${tone}`;
}
