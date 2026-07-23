// @mythicalos/react-ui — circular gauge for context/usage. `pct` 0–100. Fill color steps by
// threshold per token rule #4: accent < 75%, warn 75–89%, error ≥ 90%. Pure SVG presentation
// attributes (no inline CSS) — the stroke color is a class, the arc is a dash attribute.
//
// React twin of packages/preact-ui/src/Gauge.tsx. `gaugeGeom`/`gaugeTone` (geometry + threshold
// math) are imported from `@mythicalos/ui-core`, never reimplemented — this binding only renders
// the SVG from the values those functions return. SVG stroke attributes go through React's
// camelCase props (`strokeWidth`/`strokeDasharray`/`strokeDashoffset`), which serialize back to the
// same kebab-case DOM attributes as the Preact sibling's output.

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
    <span className="my-gauge__wrap">
      <span className="my-gauge">
        <svg width={size} height={size}>
          <circle className="my-gauge__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
          <circle
            className={`my-gauge__fill my-gauge__fill--${tone}`}
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
      </span>
      {showLabel ? <span className="my-gauge__label">{clampedPct}%</span> : null}
    </span>
  );
}
