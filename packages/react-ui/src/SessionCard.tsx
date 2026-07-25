// @mythicalos/react-ui — the `session-card` atom (design registry spec v1,
// mythical-design/ds/components-session-card.html): avatar, name, status dot + words, a meta
// subline, the context meter with its fixed threshold ticks, and the optional spine strip.
//
// React twin of packages/preact-ui/src/SessionCard.tsx. All band/status/stale/class derivation,
// subline composition, bar geometry and spine summary comes from `@mythicalos/ui-core`'s
// session-card logic module — never reimplemented here — so the two bindings cannot drift. The
// three honesty invariants (absence is not zero · unknown is not idle · thresholds are
// product-tunable) are enforced there and documented at the top of that file.
//
// Preact→React prop deltas: `class` → `className` (same rename as Chip/Avatar), and the SVG
// presentation attributes go through React's camelCase props (`preserveAspectRatio`), which
// serialize back to the same DOM attributes the Preact sibling emits. No inline `style=` anywhere
// (CSP style-src 'self').

import { Fragment, type ReactNode } from "react";
import {
  ctxBand,
  ctxReading,
  ctxBarGeom,
  normalizeCtxThresholds,
  ctxMeterClass,
  ctxNoteText,
  ctxValueText,
  sessionAvatarInitial,
  sessionCardClass,
  sessionCardIsStale,
  sessionCardStale,
  sessionSpineSummary,
  sessionStatus,
  sessionStatusClass,
  sessionStatusText,
  sessionSubline,
  spineNodeClass,
  CTX_BAR_VIEWBOX,
  CTX_THRESHOLDS_DEFAULT,
  type CtxThresholds,
  type SessionSpine,
  type SessionStatus,
  type SessionStatusInput,
} from "@mythicalos/ui-core/logic";
import { Avatar } from "./Avatar.js";

export {
  ctxBand,
  ctxReading,
  ctxBarGeom,
  normalizeCtxThresholds,
  ctxMeterClass,
  ctxNoteText,
  ctxValueText,
  sessionAvatarInitial,
  sessionCardClass,
  sessionCardIsStale,
  sessionCardStale,
  sessionSpineSummary,
  sessionStatus,
  sessionStatusClass,
  sessionStatusText,
  sessionSubline,
  spineNodeClass,
};

export interface SessionCardProps {
  /** Display name — the card's headline and the source of the avatar initial. */
  name: string;
  /**
   * The meta subline, as a free list joined with ` · `. The design card's own states use it for
   * `role · model · duration`, `role · model · queued: 1 ON-DONE` and `role · last seen 00:12 ago`
   * alike. Absent/blank entries collapse; an all-absent list omits the line entirely.
   */
  meta?: readonly (string | null | undefined)[];
  /**
   * What the product actually knows about the session. Every field is optional and every absent
   * field means "not reported" — an omitted `activity` never becomes `idle`.
   */
  status?: SessionStatusInput;
  /** The product's own wording for the derived status (e.g. a wake-specific phrase). The tone,
   *  pulse and stale treatment still come from the derivation — only the words change. A blank
   *  override, and ANY override on the `unknown` status, is ignored: nothing was claimed, so there
   *  is nothing to reword (see ui-core's `sessionStatusText`). */
  statusLabel?: string;
  /** Context reading, 0–100. `undefined`/`null` ⇒ NOT MEASURED: no fill is drawn and the value
   *  reads `—`. It is never rendered as 0. */
  contextPct?: number | null;
  /** Product-tunable warn/critical thresholds (default 75/90 — tokens.css rule #4). */
  thresholds?: CtxThresholds;
  /** Spine strip. An unreported `distills` omits the strip entirely. */
  spine?: SessionSpine;
  /** The design's selected state (petrol border + ring). Independent of `stale`. */
  selected?: boolean;
  /** ADD the design's stale treatment (dashed border, muted values) for a reason the card cannot
   *  see. It cannot be used to REMOVE the staleness a down link implies — see `sessionCardStale`. */
  stale?: boolean;
  /** Makes the card a real button. Omit for a non-interactive card. */
  onSelect?: () => void;
  className?: string;
  /** Extra content appended inside the card (e.g. a product's own mode glyph). */
  children?: ReactNode;
}

export function SessionCard(props: SessionCardProps) {
  const {
    name,
    meta = [],
    status: statusInput,
    statusLabel,
    contextPct,
    thresholds = CTX_THRESHOLDS_DEFAULT,
    spine,
    selected = false,
    onSelect,
    className: cls = "",
    children,
  } = props;

  const band = ctxBand(contextPct, thresholds);
  // the band is part of the status derivation, not a second opinion on it: the design card's
  // warn/error states replace the status line with the context claim
  const status: SessionStatus = sessionStatus(statusInput, band);
  const stale = sessionCardStale(status, props.stale);
  const bar = ctxBarGeom(contextPct, thresholds);
  const subline = sessionSubline(meta);
  const spineSummary = sessionSpineSummary(spine);

  const body = (
    <>
      <span className="my-session-card__head">
        <Avatar initials={sessionAvatarInitial(name)} className="my-session-card__avatar" />
        <span className="my-session-card__ident">
          <span className="my-session-card__line1">
            <b className="my-session-card__name">{name}</b>
            <span className={sessionStatusClass(status)}>
              <span className="my-session-card__dot" />
              <span className="my-session-card__status-text">{sessionStatusText(status, statusLabel)}</span>
            </span>
          </span>
          {subline.length > 0 ? <span className="my-session-card__meta">{subline}</span> : null}
        </span>
      </span>

      <span className={ctxMeterClass({ band, stale })}>
        <span className="my-session-card__ctx-bar">
          <svg
            className="my-session-card__ctx-svg"
            viewBox={CTX_BAR_VIEWBOX}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect className="my-session-card__ctx-track" x="0" y="0" width={bar.span} height={bar.height} />
            {/* no reading ⇒ NO fill element at all — a 0-width rect would read as a confident 0% */}
            {bar.fill === undefined ? null : (
              <rect className="my-session-card__ctx-fill" x="0" y="0" width={bar.fill} height={bar.height} />
            )}
            {bar.ticks.map((t) => (
              <rect
                key={t.pct}
                className="my-session-card__ctx-tick"
                x={t.x}
                y="0"
                width={t.width}
                height={bar.height}
              />
            ))}
          </svg>
        </span>
        <span className="my-session-card__ctx-legend">
          <span className="my-session-card__ctx-note">{ctxNoteText(band, { stale })}</span>
          <b className="my-session-card__ctx-value">{ctxValueText(contextPct, thresholds)}</b>
        </span>
      </span>

      {spineSummary === undefined ? null : (
        <>
          <span className="my-session-card__spine" aria-hidden="true">
            {spineSummary.nodes.map((node, i) => (
              <Fragment key={i}>
                {i > 0 ? <span className="my-session-card__spine-seg" /> : null}
                <span className={spineNodeClass(node)} />
              </Fragment>
            ))}
          </span>
          <span className="my-session-card__ctx-legend">
            <span className="my-session-card__spine-note">{spineSummary.label}</span>
            <b className="my-session-card__spine-value">{spineSummary.value}</b>
          </span>
        </>
      )}

      {children}
    </>
  );

  const classes = sessionCardClass({ selected, stale, extra: cls });

  return onSelect === undefined ? (
    <div className={classes}>{body}</div>
  ) : (
    <button type="button" className={classes} aria-pressed={selected} onClick={onSelect}>
      {body}
    </button>
  );
}
