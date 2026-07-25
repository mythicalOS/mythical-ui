/** @jsxImportSource preact */
// @mythicalos/preact-ui — the stat-tile row (ds/components-stat-tiles.html): a wrapping row of
// bordered tiles, each an uppercase micro key, a big mono tabular-nums value and a mono
// sub-caption. `tone: "accent"` is the card's "brag" number; `warn`/`error` are the band tint.
//
// Extracted from the reference implementation in the reference product's session detail pane, which
// hard-coded ITS five session tiles (tokens in/out, prompt cache, cost, spine savings) off a
// `SessionVm` inside the component. That composition is the product's; this atom takes an
// already-composed `StatTile[]` so each surface decides its own tiles and order. The value
// formatters (and the "—" placeholder that must never become a fabricated `0`) live in
// `@mythicalos/ui-core` and are re-exported here.

import {
  STAT_TILE_EMPTY,
  STAT_TILE_MINUS,
  formatStatCompact,
  formatStatCount,
  formatStatPercent,
  formatStatUsd,
  STAT_TILE_PARTS,
  statTileClass,
  statTilesClass,
  type StatTile,
  type StatTileTone,
} from "@mythicalos/ui-core/logic";

export {
  formatStatCompact,
  formatStatCount,
  formatStatPercent,
  formatStatUsd,
  statTileClass,
  statTilesClass,
  STAT_TILE_PARTS,
  STAT_TILE_EMPTY,
  STAT_TILE_MINUS,
  type StatTile,
  type StatTileTone,
};

export interface StatTilesProps {
  /** The tiles, in display order. A tile with no `sub` renders no sub-caption — the atom never
   *  invents one (pass `STAT_TILE_EMPTY` if you want the placeholder line). */
  tiles: readonly StatTile[];
  class?: string;
}

export function StatTiles(props: StatTilesProps) {
  const { class: cls = "" } = props;
  // A JS caller can hand a non-array where the type says `StatTile[]` (an unloaded slot); render an
  // empty row rather than crashing on `.map` — the same "absent is not a value" rule the
  // formatters follow.
  const tiles = Array.isArray(props.tiles) ? props.tiles : [];
  return (
    <div class={`${statTilesClass()} ${cls}`}>
      {tiles.map((t, i) => (
        <div class={statTileClass(t.tone)} key={`${i}:${t.label}`}>
          <div class={STAT_TILE_PARTS.label}>{t.label}</div>
          <div class={STAT_TILE_PARTS.value}>{t.value}</div>
          {t.sub !== undefined ? <div class={STAT_TILE_PARTS.sub}>{t.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
