// @mythicalos/ui-core — the KPI tile's pure geometry + prop grammar + class derivation
// (ds/components-kpi-tile: a gauge / sparkline / split-bar / plain stat tile that answers "is this
// normal?" on top of a bare number). The tile's label/value/sub row IS the shipped stat-tile atom
// (statTileClass/STAT_TILE_PARTS, ./stat-tiles.ts) — this module adds only the viz row
// (gauge/spark/split/plain) and the footer (delta + band) that sit around it, styled under the
// `my-kpi-*` family in styles.css. Both the Preact and React bindings render from these functions
// only — never a hand-rolled equivalent — so the two frameworks cannot drift apart.
//
// A KPI tile's thresholds and "which direction is good" vary per metric — a spend tile wants
// low==good, a cache-hit tile wants high==good, and some metrics carry no good/bad judgement at
// all (`neutral`). That is why this ships its own mini-gauge math (`kpiGauge`) rather than reusing
// `./gauge.ts`'s `gaugeGeom`/`gaugeTone`: that pair is fixed at one threshold pair (the context/
// usage gauge's 75/90) for a single packaged `<Gauge>` atom, and a KPI tile needs a configurable
// pair per call site, still painted with the SAME shared `.my-gauge`/`.my-gauge__fill--*` family
// (see `kpiGaugeWrapClass` below for how the two stay visually identical without colliding).

import { STAT_TILE_PARTS, statTileClass, type StatTileTone } from "./stat-tiles.js";

/* ── geometry ─────────────────────────────────────────────────────────────────────────────────
   Pure, DOM-free math — no SVG/JSX here. A binding turns these VALUES into presentation
   attributes; derived geometry (`d`, `x1`/`y1`/`x2`/`y2`, `cx`/`cy`/`r`, `x`/`width`) rides
   attributes, color always rides a class, and constant presentation values (`stroke-width`,
   `fill-opacity`, the gauge's fixed `stroke-dasharray`) ride CSS — never an inline `style=`. */

/** Sparkline geometry: a Catmull-Rom-smoothed cubic-bezier path on a `w`x`h` box (default 86x38,
 *  the tile's fixed sparkline size). */
export type KpiSpark = {
  /** The smoothed line's `d` attribute. */
  path: string;
  /** `path` extended down to the baseline and back up — the soft area fill's `d` attribute. */
  area: string;
  /** Y position of the dashed healthy-threshold band line. */
  bandY: number;
  /** The last point's position — where the hollow end dot sits. */
  lastX: number;
  lastY: number;
};

/**
 * Smooth `series` into a Catmull-Rom -> cubic-bezier curve on a `w`x`h` box. `band` is folded into
 * the plotted range so the dashed threshold line always sits inside the drawn box, even when every
 * series point is on one side of it.
 *
 * `goodIsLow` is accepted for call-site parity with `sparkInBand` (same three arguments), but this
 * function does not consume it: this is geometry only, not tone. Whether the LAST point is in band
 * or out of it (and therefore which color the caller should use) is `sparkInBand`'s job, kept
 * separate so a caller that only wants the path never pays for a tone decision it didn't ask for.
 */
export function kpiSpark(series: number[], band: number, goodIsLow: boolean, w = 86, h = 38): KpiSpark {
  void goodIsLow;
  const W = w;
  const H = h;
  const PAD = 3;
  // An empty series still draws a well-formed (flat, at-band) curve rather than throwing.
  const values = series.length > 0 ? series : [band];
  const min = Math.min(...values, band);
  const max = Math.max(...values, band);
  const rng = max - min || 1;
  const y = (n: number) => H - PAD - (H - 2 * PAD - 4) * ((n - min) / rng);
  const n = values.length;
  const denom = n > 1 ? n - 1 : 1;
  const pts: Array<[number, number]> = values.map((v, i) => [PAD + (i * (W - 2 * PAD)) / denom, y(v)]);
  const first = pts[0]!;
  let d = `M${first[0].toFixed(1)} ${first[1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const last = pts[pts.length - 1]!;
  const area = `${d} L${last[0].toFixed(1)} ${H} L${first[0].toFixed(1)} ${H} Z`;
  return {
    path: d,
    area,
    bandY: Number(y(band).toFixed(1)),
    lastX: Number(last[0].toFixed(1)),
    lastY: Number(last[1].toFixed(1)),
  };
}

/**
 * Whether the LAST point of `series` is within the healthy band — the tone decision for the
 * sparkline's line/dot (accent when `true`, warn when `false`) and its dashed band line (rest
 * color when `true`, warn when `false`); see `kpiSparkClass` below. An absent/non-finite last
 * reading reports `true` (quiet): an unreadable value is never evidence of trouble — never
 * fabricate an alarm from nothing.
 */
export function sparkInBand(series: number[], band: number, goodIsLow: boolean): boolean {
  const last = series[series.length - 1];
  if (last === undefined || !Number.isFinite(last)) return true;
  return goodIsLow ? last <= band : last >= band;
}

/**
 * Fill-tone class + dash offset for the tile's own mini gauge — the KPI tile's PER-METRIC
 * threshold pair, not the fixed context/usage pair `./gauge.ts`'s `gaugeTone` uses. `pct` is
 * clamped at BOTH bounds (0 and 100) for the dash offset, so neither an over-100 nor a negative
 * reading can push the arc past a full or empty circle; the threshold comparison uses the raw
 * `pct` (a caller handing in an already-sane percent never sees the two disagree). The offset
 * assumes the tile's fixed r=19 circle (`2 * PI * 19 ≈ 119.4`, the binding's constant
 * `stroke-dasharray`) — this function does not compute the circumference itself, unlike
 * `./gauge.ts`'s `gaugeGeom`, because the mini gauge's size never varies.
 *
 * `neutral` renders `my-gauge__fill--info` regardless of `pct`/thresholds — for metrics with no
 * good/bad judgement at all (an informational rate, say). `--info` is a fourth modifier alongside
 * the shared gauge family's `--ok`/`--warn`/`--error` triplet (styles.css), reused as-is — not a
 * KPI-only color.
 */
export function kpiGauge(pct: number, okAt: number, warnAt: number, neutral = false): { cls: string; off: number } {
  const off = Number((119.4 * (1 - Math.max(0, Math.min(pct, 100)) / 100)).toFixed(1));
  if (neutral) return { cls: "my-gauge__fill--info", off };
  const cls = pct >= okAt ? "my-gauge__fill--ok" : pct >= warnAt ? "my-gauge__fill--warn" : "my-gauge__fill--error";
  return { cls, off };
}

/** One segment of a KPI tile's split bar: `w` is a share of the 0-100-wide track, `c` a semantic
 *  tone (mapped to a `--my-*` color token in styles.css, never an inline color), `t` the segment's
 *  hover title. */
export type KpiSeg = { w: number; c: "accent" | "warn" | "muted"; t: string };

/** One split-bar segment, placed on the 0-100-wide track. */
export interface KpiSplitRect {
  x: number;
  w: number;
  c: KpiSeg["c"];
  t: string;
}

/**
 * Cumulative x-offsets for a split bar's segments, drawn as SVG `<rect>`s on a 0-100-wide track
 * (each `w` is a percentage of that track) — never CSS `width:N%`, since the segments' widths vary
 * continuously and only an SVG presentation attribute can express that without an inline style
 * (CSP). A negative `w` clamps to 0 rather than shifting later segments backwards.
 *
 * Every caller computes each `w` independently (e.g. `Math.round((100 * n) / total)` per bucket),
 * which is exactly the case where independent rounding drifts off 100 — three buckets can round to
 * 34/34/33 (101) or 33/33/33 (99). Walking the raw widths left to right would overflow the last
 * segment past the 0-100 track on a 101-sum, or leave a visible gap at the end on a 99-sum (no
 * background track is drawn behind the segments). Fixed HERE, at the geometry layer, so every call
 * site heals without its own correction: rather than placing each segment at `prevEnd + w`, this
 * rounds the CUMULATIVE position (`100 * runningSum / total`) at each step — cumulative-diff
 * rounding. Rounding a non-decreasing sequence is itself non-decreasing, so consecutive endpoints
 * never go backwards (no negative width, no overlap), and the LAST endpoint is always exactly
 * `100` (`100 * total / total`), so the segments always tile the track exactly — never short,
 * never over.
 */
export function kpiSplitRects(segs: KpiSeg[]): KpiSplitRect[] {
  const clamped = segs.map((sg) => Math.max(0, sg.w));
  const total = clamped.reduce((a, b) => a + b, 0);
  let cum = 0;
  let prevEnd = 0;
  return segs.map((sg, i) => {
    cum += clamped[i]!;
    const end = total > 0 ? Math.round((100 * cum) / total) : 0;
    const rect: KpiSplitRect = { x: prevEnd, w: Math.max(0, end - prevEnd), c: sg.c, t: sg.t };
    prevEnd = end;
    return rect;
  });
}

/* ── prop grammar ─────────────────────────────────────────────────────────────────────────────
   The fixed anatomy: label -> viz row (exactly one of gauge/spark/split/plain) -> footer
   (delta + band). Behavior rules the bindings implement from these props: tone is only ever set
   by the caller when the value is out of band (quiet when healthy); the band footer line flips
   warn when `bandBreached`; a value equal to the shared stat-tile empty glyph never draws a viz
   artifact even when `gauge`/`spark`/`segs` are still supplied — an absent reading is never
   dressed up as a chart. */

export type KpiTileProps = {
  label: string;
  value: string;
  /** Right-aligned two-line note shown beside the value for a gauge/spark/split viz. */
  beside?: string;
  viz: "gauge" | "spark" | "split" | "plain";
  /** ONLY set when the value is out of band — quiet when healthy. */
  tone?: "warn" | "error";
  gauge?: { pct: number; okAt: number; warnAt: number; neutral?: boolean };
  spark?: { series: number[]; band: number; goodIsLow: boolean };
  segs?: KpiSeg[];
  /** plain viz: right-aligned two-line note (the `beside` slot's name for this viz specifically). */
  sideNote?: string;
  delta?: string;
  deltaRef?: string;
  deltaTone?: "ok" | "warn" | "muted";
  /** Footer band label, e.g. "healthy ≤ 2.0". */
  band?: string;
  bandBreached?: boolean;
  /** Title tooltip: what to do when this tile is bad. */
  hint?: string;
};

/* ── class derivation (pure functions returning class strings — see ./tone.ts for the house
   style) ─────────────────────────────────────────────────────────────────────────────────────
   Only the parts this family adds beyond the shared stat-tile atom live here (label/value/sub
   already come from STAT_TILE_PARTS); the bindings import these constants/functions rather than
   spelling the class strings themselves, so the two frameworks cannot drift apart on a rename. */

export const KPI_TILE_PARTS = {
  tile: "my-kpi-tile",
  vizRow: "my-kpi-tile__viz-row",
  note: "my-kpi-tile__note",
  viz: "my-kpi-tile__viz",
  split: "my-kpi-split",
  deltaRow: "my-kpi-tile__delta-row",
  delta: "my-kpi-tile__delta",
  deltaRef: "my-kpi-tile__delta-ref",
  band: "my-kpi-tile__band",
} as const;

/** Tile root class: the shared stat-tile base + tone modifier, plus this family's own marker
 *  class (the fixed 112px-min, `height:100%` box — styles.css). */
export function kpiTileClass(tone?: StatTileTone): string {
  return `${statTileClass(tone)} ${KPI_TILE_PARTS.tile}`;
}

/** The mini-gauge wrapper class: the shared `.my-gauge` atom + a `my-kpi-gauge` scoping modifier
 *  that fixes its stroke width to this tile's 40x40 rendering. Deliberately NOT added to the base
 *  `.my-gauge__track`/`.my-gauge__fill` rule: that rule must keep tracking the packaged `<Gauge>`
 *  atom's variable `stroke` prop for every other consumer, and a bare `stroke-width` declaration
 *  there (a CSS rule beats an SVG presentation attribute) would silently override every other
 *  gauge on the page to 5px. Scoping it under this wrapper is what makes reusing the shared
 *  color family here safe. */
export function kpiGaugeWrapClass(): string {
  return "my-gauge my-kpi-gauge";
}

/** Sparkline wrapper class: family root + the in-band/out-of-band tone modifier. */
export function kpiSparkClass(inBand: boolean): string {
  return `my-kpi-spark my-kpi-spark--${inBand ? "ok" : "warn"}`;
}

/** Footer delta class: root + tone modifier, muted when the caller doesn't judge it. */
export function kpiDeltaClass(tone: "ok" | "warn" | "muted" = "muted"): string {
  return `${KPI_TILE_PARTS.delta} ${KPI_TILE_PARTS.delta}--${tone}`;
}

/** Footer band-line class: the shared stat-tile sub-caption + this family's own band class, with a
 *  warn modifier only when the caller marks it breached. */
export function kpiBandClass(breached?: boolean): string {
  const base = `${STAT_TILE_PARTS.sub} ${KPI_TILE_PARTS.band}`;
  return breached === true ? `${base} ${KPI_TILE_PARTS.band}--warn` : base;
}
