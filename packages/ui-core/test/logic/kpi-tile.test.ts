// test/logic/kpi-tile.test.ts — the KPI tile's pure geometry, tone and class derivation
// (ds/components-kpi-tile). Render tests (markup grammar, CSP, honesty rules) live in each
// binding package's kpi-tile.test.tsx; this file is DOM-free.

import { describe, expect, test } from "bun:test";
import {
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
} from "../../src/logic/kpi-tile.ts";

describe("kpiSpark — sparkline geometry", () => {
  test("path starts with an absolute moveto (M) and carries a cubic-bezier (C) segment", () => {
    const geo = kpiSpark([10, 40, 25, 60, 30, 55, 20, 45], 35, true);
    expect(geo.path.startsWith("M")).toBe(true);
    expect(geo.path).toContain("C");
  });

  test("area path is the line path closed down to the baseline and back (ends in Z)", () => {
    const geo = kpiSpark([10, 40, 25], 20, true);
    expect(geo.area.startsWith(geo.path)).toBe(true);
    expect(geo.area.endsWith("Z")).toBe(true);
    expect(geo.area).toContain(" L");
  });

  test("golden geometry: two points [0,100], band 50, default 86x38 box", () => {
    // hand-derived: min=0 max=100 rng=100; y(n) = 35 - 0.28n → y(0)=35, y(100)=7, y(50)=21
    // x(0)=3 (PAD), x(1)=83 (W-PAD) for a 2-point series (denom=1)
    const geo = kpiSpark([0, 100], 50, true);
    expect(geo.path).toBe("M3.0 35.0 C16.3 30.3 69.7 11.7 83.0 7.0");
    expect(geo.area).toBe("M3.0 35.0 C16.3 30.3 69.7 11.7 83.0 7.0 L83.0 38 L3.0 38 Z");
    expect(geo.bandY).toBe(21);
    expect(geo.lastX).toBe(83);
    expect(geo.lastY).toBe(7);
  });

  test("lastX always sits at the box's right pad edge (w - PAD), any series length", () => {
    expect(kpiSpark([1, 2, 3, 4, 5], 3, true).lastX).toBe(83);
    expect(kpiSpark(Array.from({ length: 8 }, (_, i) => i), 4, false).lastX).toBe(83);
  });

  test("a custom w/h box is honored", () => {
    const geo = kpiSpark([1, 2], 1.5, true, 40, 20);
    // x(1) = PAD + (40 - 2*PAD) = 40 - 3 = 37
    expect(geo.lastX).toBe(37);
  });

  test("an empty series does not throw and returns a well-formed flat path", () => {
    const geo = kpiSpark([], 10, true);
    expect(geo.path.startsWith("M")).toBe(true);
    expect(Number.isFinite(geo.bandY)).toBe(true);
  });

  test("is pure: identical inputs produce byte-identical output", () => {
    const a = kpiSpark([5, 8, 3, 9], 6, false);
    const b = kpiSpark([5, 8, 3, 9], 6, false);
    expect(a).toEqual(b);
  });
});

describe("sparkInBand — the sparkline's tone decision (kept separate from geometry)", () => {
  test("goodIsLow=true: at/under the band is in-band, over it is not", () => {
    expect(sparkInBand([10, 20, 30], 30, true)).toBe(true); // 30 <= 30
    expect(sparkInBand([10, 20, 31], 30, true)).toBe(false); // 31 > 30
  });

  test("goodIsLow=false: at/over the band is in-band, under it is not", () => {
    expect(sparkInBand([10, 20, 30], 30, false)).toBe(true); // 30 >= 30
    expect(sparkInBand([10, 20, 29], 30, false)).toBe(false); // 29 < 30
  });

  test("golden case from the 2-point series above: goodIsLow flips the verdict", () => {
    const series = [0, 100];
    expect(sparkInBand(series, 50, true)).toBe(false); // low is good, last=100 is over
    expect(sparkInBand(series, 50, false)).toBe(true); // high is good, last=100 is over-band-good
  });

  test("an unreadable last point reports in-band (quiet, never a fabricated alarm)", () => {
    expect(sparkInBand([1, 2, NaN], 5, true)).toBe(true);
    expect(sparkInBand([], 5, true)).toBe(true);
  });
});

describe("kpiGauge — the KPI tile's own threshold pair (not the fixed context/usage 75/90)", () => {
  test("pct at/above okAt is the ok tone", () => {
    expect(kpiGauge(80, 75, 50).cls).toBe("my-gauge__fill--ok");
    expect(kpiGauge(75, 75, 50).cls).toBe("my-gauge__fill--ok");
  });

  test("pct between warnAt and okAt is the warn tone", () => {
    expect(kpiGauge(60, 75, 50).cls).toBe("my-gauge__fill--warn");
  });

  test("pct below warnAt is the error tone", () => {
    expect(kpiGauge(30, 75, 50).cls).toBe("my-gauge__fill--error");
  });

  test("neutral forces the info tone regardless of pct/thresholds", () => {
    expect(kpiGauge(5, 75, 50, true).cls).toBe("my-gauge__fill--info");
    expect(kpiGauge(95, 75, 50, true).cls).toBe("my-gauge__fill--info");
  });

  test("dash offset: 119.4 donut, 0% = full offset, 100% = no offset", () => {
    expect(kpiGauge(0, 75, 50).off).toBe(119.4);
    expect(kpiGauge(100, 75, 50).off).toBe(0);
    expect(kpiGauge(50, 75, 50).off).toBe(59.7);
  });

  test("an over-100 pct clamps the offset to 0 rather than going negative", () => {
    expect(kpiGauge(150, 75, 50).off).toBe(0);
  });

  test("a negative pct clamps the offset to 119.4 (full donut, empty) rather than going below 0", () => {
    expect(kpiGauge(-5, 75, 50).off).toBe(119.4);
    expect(kpiGauge(-5, 75, 50).off).toBe(kpiGauge(0, 75, 50).off);
  });
});

describe("kpiSplitRects — split-bar segment placement", () => {
  test("segments are placed left-to-right with cumulative x offsets", () => {
    const segs: KpiSeg[] = [
      { w: 60, c: "accent", t: "working" },
      { w: 25, c: "warn", t: "waiting on you" },
      { w: 15, c: "muted", t: "idle" },
    ];
    const rects = kpiSplitRects(segs);
    expect(rects).toEqual([
      { x: 0, w: 60, c: "accent", t: "working" },
      { x: 60, w: 25, c: "warn", t: "waiting on you" },
      { x: 85, w: 15, c: "muted", t: "idle" },
    ]);
  });

  test("a negative width clamps to 0 rather than shifting later segments backwards — the sole surviving segment fills the whole track (segments always tile 0-100 exactly)", () => {
    const rects = kpiSplitRects([
      { w: -10, c: "muted", t: "n/a" },
      { w: 40, c: "accent", t: "ok" },
    ]);
    expect(rects[0]).toEqual({ x: 0, w: 0, c: "muted", t: "n/a" });
    expect(rects[1]).toEqual({ x: 0, w: 100, c: "accent", t: "ok" });
  });

  test("a 3-bucket case whose naive independent rounding sums to 101 (34/34/33) ends exactly at 100, no overlap past the track", () => {
    const rects = kpiSplitRects([
      { w: 34, c: "accent", t: "a" },
      { w: 34, c: "warn", t: "b" },
      { w: 33, c: "muted", t: "c" },
    ]);
    expect(rects[1]!.x).toBe(rects[0]!.x + rects[0]!.w);
    expect(rects[2]!.x).toBe(rects[1]!.x + rects[1]!.w);
    expect(rects[2]!.x + rects[2]!.w).toBe(100);
  });

  test("a 3-bucket case whose naive independent rounding sums to 99 (33/33/33) leaves no gap — ends exactly at 100", () => {
    const rects = kpiSplitRects([
      { w: 33, c: "accent", t: "a" },
      { w: 33, c: "warn", t: "b" },
      { w: 33, c: "muted", t: "c" },
    ]);
    expect(rects[1]!.x).toBe(rects[0]!.x + rects[0]!.w);
    expect(rects[2]!.x).toBe(rects[1]!.x + rects[1]!.w);
    expect(rects[2]!.x + rects[2]!.w).toBe(100);
  });

  test("an all-zero (or empty-after-clamp) input draws no track at all, rather than dividing by zero", () => {
    const rects = kpiSplitRects([
      { w: 0, c: "accent", t: "a" },
      { w: -5, c: "warn", t: "b" },
    ]);
    expect(rects).toEqual([
      { x: 0, w: 0, c: "accent", t: "a" },
      { x: 0, w: 0, c: "warn", t: "b" },
    ]);
  });
});

describe("class derivation", () => {
  test("kpiTileClass — the shared stat-tile base + this family's marker class", () => {
    expect(kpiTileClass()).toBe("my-stat-tile my-kpi-tile");
    expect(kpiTileClass("warn")).toBe("my-stat-tile my-stat-tile--warn my-kpi-tile");
    expect(kpiTileClass("error")).toBe("my-stat-tile my-stat-tile--error my-kpi-tile");
  });

  test("kpiGaugeWrapClass — the shared gauge atom + the stroke-width scoping modifier", () => {
    expect(kpiGaugeWrapClass()).toBe("my-gauge my-kpi-gauge");
  });

  test("kpiSparkClass — family root + in-band/out-of-band tone", () => {
    expect(kpiSparkClass(true)).toBe("my-kpi-spark my-kpi-spark--ok");
    expect(kpiSparkClass(false)).toBe("my-kpi-spark my-kpi-spark--warn");
  });

  test("kpiDeltaClass — defaults to muted, every tone is one modifier", () => {
    expect(kpiDeltaClass()).toBe("my-kpi-tile__delta my-kpi-tile__delta--muted");
    expect(kpiDeltaClass("ok")).toBe("my-kpi-tile__delta my-kpi-tile__delta--ok");
    expect(kpiDeltaClass("warn")).toBe("my-kpi-tile__delta my-kpi-tile__delta--warn");
  });

  test("kpiBandClass — the shared sub-caption + this family's band class, warn only when breached", () => {
    expect(kpiBandClass()).toBe("my-stat-tile__sub my-kpi-tile__band");
    expect(kpiBandClass(false)).toBe("my-stat-tile__sub my-kpi-tile__band");
    expect(kpiBandClass(true)).toBe("my-stat-tile__sub my-kpi-tile__band my-kpi-tile__band--warn");
  });

  test("KPI_TILE_PARTS carries every element class the bindings render", () => {
    expect(KPI_TILE_PARTS.tile).toBe("my-kpi-tile");
    expect(KPI_TILE_PARTS.vizRow).toBe("my-kpi-tile__viz-row");
    expect(KPI_TILE_PARTS.note).toBe("my-kpi-tile__note");
    expect(KPI_TILE_PARTS.viz).toBe("my-kpi-tile__viz");
    expect(KPI_TILE_PARTS.split).toBe("my-kpi-split");
    expect(KPI_TILE_PARTS.deltaRow).toBe("my-kpi-tile__delta-row");
    expect(KPI_TILE_PARTS.delta).toBe("my-kpi-tile__delta");
    expect(KPI_TILE_PARTS.deltaRef).toBe("my-kpi-tile__delta-ref");
    expect(KPI_TILE_PARTS.band).toBe("my-kpi-tile__band");
  });
});
