// @mythicalos/ui-core — tone axis and class derivation for chip/status/banner + shared gauge/dialog
// tri-state (ds/tokens rule #4 and rule #7: status never relies on color alone — an icon/glyph
// always rides along). Both the Preact and React bindings import from here so they derive identical
// class strings from one source.

export type Tone = "ok" | "warn" | "error";

// Chip tone (design-export/packages/preact-ui/src/components/Chip.jsx): supports 6 tones.
// Class derivation: base "my-chip" + tone modifier (neutral has no modifier).
export type ChipTone = "neutral" | "accent" | "ok" | "warn" | "error" | "info";
export function chipClass(tone: ChipTone): string {
  return tone === "neutral" ? "my-chip" : `my-chip my-chip--${tone}`;
}

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
