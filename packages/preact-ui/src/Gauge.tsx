/** @jsxImportSource preact */
// @mythicalos/preact-ui — circular gauge for context/usage. `pct` 0–100. Fill color steps by
// threshold per token rule #4: accent < 75%, warn 75–89%, error ≥ 90%. Pure SVG presentation
// attributes (no inline CSS) — the stroke color is a class, the arc is a dash attribute.
//
// Ported from design-export's packages/preact-ui/src/components/Gauge.jsx (JSX→TSX, typed props).
// The source computed `r`/`circ`/`offset`/`tone` inline; that geometry + threshold math now lives
// in `@mythicalos/ui-core` as `gaugeGeom`/`gaugeTone` (Task 2, ported verbatim) — this binding only
// renders the SVG from the values those functions return.

import { gaugeGeom, gaugeTone, type GaugeGeom, type Tone } from "@mythicalos/ui-core/logic";

export { gaugeGeom, gaugeTone, type GaugeGeom, type Tone };

export interface GaugeProps {
  pct?: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}

export function Gauge(props: GaugeProps) {
  const { pct = 0, size = 44, stroke = 4, showLabel = true } = props;
  const { r, circ, offset } = gaugeGeom(size, stroke, pct);
  const tone = gaugeTone(pct);
  // gaugeGeom/gaugeTone each clamp `pct` to 0–100 independently (ui-core's gauge.ts: "so either
  // can be called on its own ... and stay consistent with the other"); the label needs that same
  // 0–100 clamp to restate the identical number as a percentage — trivial arithmetic, not the
  // tone/geometry derivation itself, which stays entirely in gaugeTone/gaugeGeom above.
  const clampedPct = Math.round(Math.max(0, Math.min(100, pct)));
  return (
    <span class="my-gauge__wrap">
      <span class="my-gauge">
        <svg width={size} height={size}>
          <circle class="my-gauge__track" cx={size / 2} cy={size / 2} r={r} stroke-width={stroke} />
          <circle
            class={`my-gauge__fill my-gauge__fill--${tone}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke-width={stroke}
            stroke-dasharray={circ}
            stroke-dashoffset={offset}
          />
        </svg>
      </span>
      {showLabel ? <span class="my-gauge__label">{clampedPct}%</span> : null}
    </span>
  );
}
