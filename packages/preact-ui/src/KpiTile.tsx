/** @jsxImportSource preact */
// @mythicalos/preact-ui — the KPI tile (ds/components-kpi-tile): a gauge / sparkline / split-bar /
// plain stat tile, fixed grammar top to bottom: label -> viz row -> footer (delta + band). Built
// on the shipped `statTileClass`/`STAT_TILE_PARTS` atom for label/value/sub; this component adds
// only the viz/delta/band rows, styled under the `my-kpi-*` family in `@mythicalos/ui-core`'s
// styles.css. Render + framework wiring only — every class string and every SVG geometry value is
// derived by `@mythicalos/ui-core` so this binding and its React sibling can never drift.
//
// CSP: no inline `style=` anywhere — constant SVG presentation attributes (`stroke-width`,
// `fill-opacity`, the gauge's fixed `stroke-dasharray`) ride CSS rules, and derived SVG geometry
// (`d`, `stroke-dasharray`/`stroke-dashoffset` on the gauge, `cx`/`cy`/`r`, `x`/`width`) rides
// presentation attributes; color always rides a class.
//
// Behavior rules: tone (`my-stat-tile--warn`/`--error`) is set by the CALLER only when the value is
// out of band — quiet when healthy. The band footer line flips warn when `bandBreached`. The tile
// is a fixed 112px-min, `height:100%` box so a row of tiles is always equal height. A value equal
// to the shared stat-tile empty glyph never draws a viz artifact even if `gauge`/`spark`/`segs`
// were still supplied — an absent reading is never dressed up as a chart.

import {
  KPI_TILE_PARTS,
  STAT_TILE_EMPTY,
  STAT_TILE_PARTS,
  kpiBandClass,
  kpiDeltaClass,
  kpiGauge,
  kpiGaugeWrapClass,
  kpiSpark,
  kpiSparkClass,
  kpiSplitRects,
  kpiTileClass,
  sparkInBand,
  type KpiSeg,
  type KpiTileProps,
} from "@mythicalos/ui-core/logic";

// STAT_TILE_EMPTY/STAT_TILE_PARTS are NOT re-exported here — StatTiles.tsx already re-exports
// them (this atom shares the same label/value/sub slot), and the barrel would otherwise declare
// the same name twice.
export {
  KPI_TILE_PARTS,
  kpiBandClass,
  kpiDeltaClass,
  kpiGauge,
  kpiGaugeWrapClass,
  kpiSpark,
  kpiSparkClass,
  kpiSplitRects,
  kpiTileClass,
  sparkInBand,
  type KpiSeg,
  type KpiTileProps,
};

function KpiGaugeViz(props: { pct: number; okAt: number; warnAt: number; neutral?: boolean }) {
  const g = kpiGauge(props.pct, props.okAt, props.warnAt, props.neutral === true);
  return (
    <span class={`${kpiGaugeWrapClass()} ${KPI_TILE_PARTS.viz}`}>
      <svg viewBox="0 0 44 44" width="40" height="40" aria-hidden="true">
        <circle class="my-gauge__track" cx="22" cy="22" r="19" />
        <circle class={`my-gauge__fill ${g.cls}`} cx="22" cy="22" r="19" stroke-dasharray="119.4" stroke-dashoffset={g.off} />
      </svg>
    </span>
  );
}

function KpiSparkViz(props: { series: number[]; band: number; goodIsLow: boolean }) {
  const geo = kpiSpark(props.series, props.band, props.goodIsLow);
  const inBand = sparkInBand(props.series, props.band, props.goodIsLow);
  return (
    <svg class={`${kpiSparkClass(inBand)} ${KPI_TILE_PARTS.viz}`} viewBox="0 0 86 38" width="86" height="38" aria-hidden="true">
      <path class="my-kpi-spark__area" d={geo.area} />
      <line class="my-kpi-spark__band" x1="3" x2="83" y1={geo.bandY} y2={geo.bandY} stroke-dasharray="3 3" />
      <path class="my-kpi-spark__line" d={geo.path} />
      <circle class="my-kpi-spark__dot" cx={geo.lastX} cy={geo.lastY} r="2.4" />
    </svg>
  );
}

function KpiSplitViz(props: { segs: KpiSeg[] }) {
  const rects = kpiSplitRects(props.segs);
  return (
    <svg class={KPI_TILE_PARTS.split} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
      {rects.map((r, i) => (
        <rect key={i} class={`my-kpi-split__seg my-kpi-split__seg--${r.c}`} x={r.x} y="0" width={r.w} height="6">
          <title>{r.t}</title>
        </rect>
      ))}
    </svg>
  );
}

export function KpiTile(props: KpiTileProps) {
  const isAbsent = props.value === STAT_TILE_EMPTY;
  const note = props.viz === "plain" ? props.sideNote : props.beside;
  const showDelta = props.delta !== undefined || props.deltaRef !== undefined;
  return (
    <div class={kpiTileClass(props.tone)} title={props.hint}>
      <span class={STAT_TILE_PARTS.label}>{props.label}</span>
      <div class={KPI_TILE_PARTS.vizRow}>
        <span class={STAT_TILE_PARTS.value}>{props.value}</span>
        {note !== undefined ? <span class={KPI_TILE_PARTS.note}>{note}</span> : null}
        {!isAbsent && props.viz === "gauge" && props.gauge !== undefined ? <KpiGaugeViz {...props.gauge} /> : null}
        {!isAbsent && props.viz === "spark" && props.spark !== undefined ? <KpiSparkViz {...props.spark} /> : null}
      </div>
      {!isAbsent && props.viz === "split" && props.segs !== undefined ? <KpiSplitViz segs={props.segs} /> : null}
      {showDelta ? (
        <div class={KPI_TILE_PARTS.deltaRow}>
          <span class={kpiDeltaClass(props.deltaTone)}>{props.delta}</span>
          {props.deltaRef !== undefined ? <span class={KPI_TILE_PARTS.deltaRef}>{props.deltaRef}</span> : null}
        </div>
      ) : null}
      {props.band !== undefined ? <div class={kpiBandClass(props.bandBreached)}>{props.band}</div> : null}
    </div>
  );
}
