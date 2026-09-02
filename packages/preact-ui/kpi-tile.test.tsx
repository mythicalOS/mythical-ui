/** @jsxImportSource preact */
// packages/preact-ui/kpi-tile.test.tsx — render contracts for KpiTile (ds/components-kpi-tile).
// Pure geometry/tone math is covered in ui-core's test/logic/kpi-tile.test.ts; this file asserts
// the markup grammar and the CSP/honesty behavior rules the component implements. Expected class
// strings are derived by importing the CORE functions/constants directly, never hard-coded, so the
// binding and `@mythicalos/ui-core` can never silently drift.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import {
  KPI_TILE_PARTS,
  STAT_TILE_PARTS,
  kpiBandClass,
  kpiDeltaClass,
  kpiGauge,
  kpiGaugeWrapClass,
  kpiSparkClass,
  kpiTileClass,
  sparkInBand,
} from "@mythicalos/ui-core/logic";
import { KpiTile, type KpiTileProps } from "./src/index.ts";

function tile(props: KpiTileProps): string {
  return renderToString(<KpiTile {...props} />);
}

describe("KpiTile — the shared stat-tile atom", () => {
  test("renders on the shipped statTileClass/STAT_TILE_PARTS atom plus this family's marker class", () => {
    const html = tile({ label: "Spend today", value: "$24.10", viz: "plain" });
    expect(html).toContain(`class="${kpiTileClass()}"`);
    expect(html).toContain(`class="${STAT_TILE_PARTS.label}"`);
    expect(html).toContain(">Spend today<");
    expect(html).toContain(`class="${STAT_TILE_PARTS.value}"`);
    expect(html).toContain(">$24.10<");
  });

  test("a label carrying an inline count renders verbatim", () => {
    expect(tile({ label: "Findings · 6", value: "6", viz: "plain" })).toContain("Findings · 6");
  });

  test("tone is quiet (no --warn/--error) when healthy — the caller simply omits it", () => {
    const html = tile({ label: "Cost", value: "$4.00", viz: "plain" });
    expect(html).not.toContain("my-stat-tile--warn");
    expect(html).not.toContain("my-stat-tile--error");
  });

  test("tone renders the DS modifier only when the caller marks the value out of band", () => {
    expect(tile({ label: "Cost", value: "$40.00", viz: "plain", tone: "warn" })).toContain(`class="${kpiTileClass("warn")}"`);
    expect(tile({ label: "Cost", value: "$90.00", viz: "plain", tone: "error" })).toContain(`class="${kpiTileClass("error")}"`);
  });

  test("hint rides the tile's own title attribute (what to do when this is bad)", () => {
    const html = tile({ label: "Cost", value: "$4", viz: "plain", hint: "check the spend breakdown" });
    expect(html).toContain('title="check the spend breakdown"');
  });

  test("no inline style= anywhere in the rendered markup (CSP)", () => {
    const html = tile({
      label: "Context",
      value: "62%",
      viz: "gauge",
      gauge: { pct: 62, okAt: 75, warnAt: 50 },
      delta: "▲ 4%",
      deltaRef: "vs last hour",
      band: "healthy ≤ 75%",
    });
    expect(html).not.toMatch(/style\s*=/);
  });
});

describe("KpiTile — gauge viz", () => {
  test("draws the mini donut with the threshold-toned fill class", () => {
    const html = tile({ label: "Cache hit", value: "82%", viz: "gauge", gauge: { pct: 82, okAt: 75, warnAt: 50 } });
    expect(html).toContain(kpiGaugeWrapClass());
    expect(html).toContain("my-gauge__track");
    expect(html).toContain(`my-gauge__fill ${kpiGauge(82, 75, 50).cls}`);
    expect(html).toContain('stroke-dasharray="119.4"');
  });

  test("warn/error/neutral thresholds map to the right fill class", () => {
    expect(tile({ label: "x", value: "60%", viz: "gauge", gauge: { pct: 60, okAt: 75, warnAt: 50 } })).toContain(
      kpiGauge(60, 75, 50).cls,
    );
    expect(tile({ label: "x", value: "30%", viz: "gauge", gauge: { pct: 30, okAt: 75, warnAt: 50 } })).toContain(
      kpiGauge(30, 75, 50).cls,
    );
    expect(
      tile({ label: "x", value: "30%", viz: "gauge", gauge: { pct: 30, okAt: 75, warnAt: 50, neutral: true } }),
    ).toContain(kpiGauge(30, 75, 50, true).cls);
  });

  test("beside renders alongside a gauge (the design card's 'Cache · fleet' shape)", () => {
    const html = tile({
      label: "Cache · fleet",
      value: "68%",
      viz: "gauge",
      gauge: { pct: 68, okAt: 60, warnAt: 30 },
      beside: "of input\ncached",
    });
    expect(html).toContain("of input");
    expect(html).toContain("cached");
  });
});

describe("KpiTile — spark viz", () => {
  test("draws the smoothed line + dashed band + end dot, toned by whether the last point is in band", () => {
    const html = tile({
      label: "Spend today",
      value: "$24.10",
      viz: "spark",
      spark: { series: [18, 22, 19, 26, 24], band: 30, goodIsLow: true },
    });
    expect(html).toContain(kpiSparkClass(true)); // last point (24) is under the 30 budget band
    expect(html).toContain("my-kpi-spark__area");
    expect(html).toContain("my-kpi-spark__band");
    expect(html).toContain("my-kpi-spark__dot");
  });

  test("an out-of-band last point flips the spark's tone to warn", () => {
    const html = tile({
      label: "Spend today",
      value: "$34.10",
      viz: "spark",
      spark: { series: [18, 22, 19, 26, 34], band: 30, goodIsLow: true },
    });
    expect(sparkInBand([18, 22, 19, 26, 34], 30, true)).toBe(false);
    expect(html).toContain(kpiSparkClass(false));
    expect(html).not.toContain(kpiSparkClass(true));
  });
});

describe("KpiTile — split viz", () => {
  test("draws one SVG rect per segment with the semantic tone class and a title, as a sibling BELOW the viz row", () => {
    const html = tile({
      label: "Live sessions · 4",
      value: "2 need you",
      viz: "split",
      segs: [
        { w: 50, c: "accent", t: "2 working" },
        { w: 25, c: "warn", t: "1 waiting on you" },
        { w: 25, c: "muted", t: "1 idle" },
      ],
    });
    expect(html).toContain(KPI_TILE_PARTS.split);
    expect(html).toContain("my-kpi-split__seg--accent");
    expect(html).toContain("my-kpi-split__seg--warn");
    expect(html).toContain("my-kpi-split__seg--muted");
    expect(html).toContain("2 working");
    expect((html.match(/<rect/g) ?? []).length).toBe(3);
    // the split bar is NOT inside the viz row — it renders full tile width below it
    expect(html.indexOf(KPI_TILE_PARTS.vizRow)).toBeLessThan(html.indexOf(KPI_TILE_PARTS.split));
    expect(html.indexOf("</div>")).toBeLessThan(html.indexOf(KPI_TILE_PARTS.split));
  });
});

describe("KpiTile — plain viz", () => {
  test("renders the value + right-aligned two-line side note, no chart artifact", () => {
    const html = tile({ label: "tokens out", value: "18.2k", viz: "plain", sideNote: "completion\nthis session" });
    expect(html).toContain("completion");
    expect(html).toContain("this session");
    expect(html).not.toContain("my-kpi-spark");
    expect(html).not.toContain("my-gauge");
    expect(html).not.toContain(KPI_TILE_PARTS.split);
  });
});

describe("KpiTile — footer (delta + band)", () => {
  test("delta renders with its tone color class and reference text on one line", () => {
    const html = tile({ label: "Cost", value: "$24", viz: "plain", delta: "▲ $4.90", deltaRef: "vs yesterday", deltaTone: "warn" });
    expect(html).toContain(`class="${kpiDeltaClass("warn")}"`);
    expect(html).toContain("▲ $4.90");
    expect(html).toContain("vs yesterday");
  });

  test("delta tone defaults to muted when the caller doesn't judge it", () => {
    const html = tile({ label: "Cost", value: "$24", viz: "plain", delta: "▲ $4.90" });
    expect(html).toContain(`class="${kpiDeltaClass()}"`);
  });

  test("band label renders on the shared sub row, muted by default", () => {
    const html = tile({ label: "Cost", value: "$24", viz: "plain", band: "≤ $30/day budget" });
    expect(html).toContain(`class="${kpiBandClass(false)}"`);
    expect(html).toContain("≤ $30/day budget");
  });

  test("band line flips to the warn tone when bandBreached", () => {
    const html = tile({ label: "Cost", value: "$34", viz: "plain", band: "over $30/day budget", bandBreached: true });
    expect(html).toContain(`class="${kpiBandClass(true)}"`);
  });

  test("no delta/band props render no footer rows at all", () => {
    const html = tile({ label: "Cost", value: "$24", viz: "plain" });
    expect(html).not.toContain(KPI_TILE_PARTS.deltaRow);
    expect(html).not.toContain(KPI_TILE_PARTS.band);
  });
});

describe("KpiTile — honesty: an absent value never wears a fabricated chart", () => {
  test("a `—` value renders no gauge artifact even if gauge props are (mistakenly) still supplied", () => {
    const html = tile({ label: "Recall health", value: "—", viz: "gauge", gauge: { pct: 62, okAt: 60, warnAt: 40 } });
    expect(html).toContain("—");
    expect(html).not.toContain("my-gauge");
  });

  test("a `—` value renders no spark artifact even if spark props are still supplied", () => {
    const html = tile({ label: "Spend today", value: "—", viz: "spark", spark: { series: [1, 2, 3], band: 2, goodIsLow: true } });
    expect(html).not.toContain("my-kpi-spark");
  });

  test("a `—` value renders no split artifact even if segs are still supplied", () => {
    const html = tile({ label: "Live sessions", value: "—", viz: "split", segs: [{ w: 100, c: "muted", t: "unknown" }] });
    expect(html).not.toContain(KPI_TILE_PARTS.split);
  });
});
