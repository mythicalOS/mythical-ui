// @mythicalos/react-ui — tab segments (ds/components-seg): the squared segmented view-switcher.
// React twin of packages/preact-ui/src/Seg.tsx. NOT the theme toggle — that family's pill is a
// scoped rule-10 exception. Classes come from `@mythicalos/ui-core`'s segClass/segOptionClass;
// this binding only renders. The pages are view switchers and filters, so the row announces as a
// tablist (role="tablist"/"tab" + aria-selected); the count slot renders only what ui-core's
// segCountText validates — a malformed count renders nothing rather than a number the caller
// never measured.

import type { ReactNode } from "react";
import { SEG_PARTS, segClass, segCountText, segOptionClass } from "@mythicalos/ui-core/logic";

export { SEG_PARTS, segClass, segCountText, segOptionClass };

export interface SegOption {
  /** Stable identity handed back to `onChange` — never the array index. */
  key: string;
  /** The face: a word, or word + chip/glyph markup (the pages do both). */
  label: ReactNode;
  /** Optional count beside the label (the run-filter variant). */
  count?: number;
}

export interface SegProps {
  options: readonly SegOption[];
  /** The selected option's key. */
  value?: string;
  onChange?: (key: string) => void;
  /** Stretch options to fill the row (the lens variant); content-width otherwise. */
  grow?: boolean;
  /** Accessible name for the tablist. */
  label?: string;
  className?: string;
}

export function Seg(props: SegProps) {
  const { grow = false, className: cls = "" } = props;
  // Non-array tolerance, same reason as StatTiles: render an empty track rather than crash.
  const options = Array.isArray(props.options) ? props.options : [];
  return (
    <div className={`${segClass({ grow })} ${cls}`} role="tablist" aria-label={props.label}>
      {options.map((opt) => {
        const selected = opt.key === props.value;
        const count = segCountText(opt.count);
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            className={segOptionClass({ selected })}
            aria-selected={selected}
            onClick={props.onChange ? () => props.onChange?.(opt.key) : undefined}
          >
            {opt.label}
            {count !== null ? <span className={SEG_PARTS.count}>{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
