// @mythicalos/ui-core — the pure circular-gauge math (context/usage gauge). Extracted from
// design-export's packages/preact-ui/src/components/Gauge.jsx, which mixed this geometry into a
// Preact `h()` render. `pct` is clamped to 0–100 before either the tone or the arc offset is
// derived, matching the source's `clamped` value — both functions clamp independently so either
// can be called on its own with an out-of-range input and stay consistent with the other.

import type { Tone } from "./tone.ts";

/** Fill color steps by threshold per token rule #4: ok/accent < 75%, warn 75–89%, error ≥ 90%. */
export function gaugeTone(pct: number): Tone {
  const clamped = Math.max(0, Math.min(100, pct));
  return clamped >= 90 ? "error" : clamped >= 75 ? "warn" : "ok";
}

export interface GaugeGeom {
  /** The circle radius, inset by half the stroke width. */
  r: number;
  /** The full circumference — the SVG circle's `stroke-dasharray`. */
  circ: number;
  /** The `stroke-dashoffset` for the filled arc at `pct` (0 ⇒ full circle drawn, `circ` ⇒ none). */
  offset: number;
}

/** Pure SVG geometry (no inline CSS) — the stroke color is a class, the arc is a dash attribute. */
export function gaugeGeom(size: number, stroke: number, pct: number): GaugeGeom {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circ * (1 - clamped / 100);
  return { r, circ, offset };
}
