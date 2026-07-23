// @mythicalos/ui-core — the shared tri-state tone axis (ds/tokens rule #4 and rule #7: status
// never relies on color alone — an icon/glyph always rides along). `DialogBullet` (dialog.ts) and
// the gauge fill (gauge.ts) both key off exactly this "ok" | "warn" | "error" set; this module is
// the one place that union is spelled so both stay structurally identical without re-declaring it.
//
// NOTE (scope call, see task report): the design-export reference package also has Chip/StatusLine/
// Banner components with their own tone maps (Chip: +"neutral"/"accent"; Banner glyphs differ from
// BULLET_ICON's). Those were never named as source material for this port (only Gauge.jsx was) and
// skuld's own package.test.ts pins `"stepChipClass" in barrel === false` — chip-family helpers were
// deliberately kept product-side historically. So no chip/statusline/banner-specific map is ported
// here; only this shared 3-tone alias is provided pending a real ui-core Chip/StatusLine/Banner task.

export type Tone = "ok" | "warn" | "error";
