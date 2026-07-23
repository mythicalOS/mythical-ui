// test/logic/gauge.test.ts — new coverage for the geometry extracted from design-export's
// packages/preact-ui/src/components/Gauge.jsx (gaugeTone/gaugeGeom did not have a standalone unit
// test in the source Preact component — this is the pure-logic home for that math).

import { describe, expect, test } from "bun:test";
import { gaugeGeom, gaugeTone } from "../../src/logic/gauge.ts";

describe("gaugeTone — fill color steps by threshold (token rule #4)", () => {
  test("74 → ok (below the warn threshold)", () => {
    expect(gaugeTone(74)).toBe("ok");
  });
  test("75 → warn (the ok/warn boundary)", () => {
    expect(gaugeTone(75)).toBe("warn");
  });
  test("89 → warn (just below the error threshold)", () => {
    expect(gaugeTone(89)).toBe("warn");
  });
  test("90 → error (the warn/error boundary)", () => {
    expect(gaugeTone(90)).toBe("error");
  });
  test("0 → ok, 100 → error", () => {
    expect(gaugeTone(0)).toBe("ok");
    expect(gaugeTone(100)).toBe("error");
  });
  test("out-of-range pct is clamped before the tone is derived", () => {
    expect(gaugeTone(-10)).toBe("ok");
    expect(gaugeTone(150)).toBe("error");
  });
});

describe("gaugeGeom — pure SVG circle math (no inline CSS; the arc is a dash attribute)", () => {
  test("radius insets by half the stroke width", () => {
    expect(gaugeGeom(44, 4, 0).r).toBe(20);
    expect(gaugeGeom(100, 10, 0).r).toBe(45);
  });
  test("circumference is 2πr", () => {
    const { r, circ } = gaugeGeom(44, 4, 0);
    expect(circ).toBeCloseTo(2 * Math.PI * r, 10);
  });
  test("pct=0 → offset equals the full circumference (nothing filled)", () => {
    const { circ, offset } = gaugeGeom(44, 4, 0);
    expect(offset).toBeCloseTo(circ, 10);
  });
  test("pct=100 → offset is 0 (fully filled)", () => {
    const { offset } = gaugeGeom(44, 4, 100);
    expect(offset).toBeCloseTo(0, 10);
  });
  test("pct=50 → offset is half the circumference", () => {
    const { circ, offset } = gaugeGeom(44, 4, 50);
    expect(offset).toBeCloseTo(circ / 2, 10);
  });
  test("out-of-range pct is clamped before the offset is derived", () => {
    const atMax = gaugeGeom(44, 4, 100);
    const over = gaugeGeom(44, 4, 250);
    expect(over.offset).toBeCloseTo(atMax.offset, 10);
    const atMin = gaugeGeom(44, 4, 0);
    const under = gaugeGeom(44, 4, -50);
    expect(under.offset).toBeCloseTo(atMin.offset, 10);
  });
});
