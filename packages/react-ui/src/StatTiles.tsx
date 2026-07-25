// @mythicalos/react-ui — the stat-tile row (ds/components-stat-tiles.html): a wrapping row of
// bordered tiles, each an uppercase micro key, a big mono tabular-nums value and a mono
// sub-caption. `tone: "accent"` is the card's "brag" number; `warn`/`error` are the band tint.
//
// React twin of packages/preact-ui/src/StatTiles.tsx. Class derivation and the value formatters
// (with the "—" placeholder that must never become a fabricated `0`) come from
// `@mythicalos/ui-core`. Preact→React prop delta: `class` → `className`.

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
  className?: string;
}

export function StatTiles(props: StatTilesProps) {
  const { className: cls = "" } = props;
  // A JS caller can hand a non-array where the type says `StatTile[]` (an unloaded slot); render an
  // empty row rather than crashing on `.map` — the same "absent is not a value" rule the
  // formatters follow.
  const tiles = Array.isArray(props.tiles) ? props.tiles : [];
  return (
    <div className={`${statTilesClass()} ${cls}`}>
      {tiles.map((t, i) => (
        <div className={statTileClass(t.tone)} key={`${i}:${t.label}`}>
          <div className={STAT_TILE_PARTS.label}>{t.label}</div>
          <div className={STAT_TILE_PARTS.value}>{t.value}</div>
          {t.sub !== undefined ? <div className={STAT_TILE_PARTS.sub}>{t.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
