// @mythicalos/react-ui — the terminal pane (ds/components-terminal, spec v2). React twin of
// packages/preact-ui/src/Terminal.tsx. ALWAYS heritage-dark in both themes (token rule 3): the
// surface is pinned by ui-core's `.my-term` block, never by a theme-conditional class here.
//
// Thin binding: render + wiring only. Every class string (`TERM_CLASSES`), every user-visible
// string, the six-branch source resolution, the segmentation, the row keying and the Ctrl-C
// predicate come from `@mythicalos/ui-core` — this file types no class literal and no copy of its
// own, so it and its Preact sibling cannot drift.
//
// Honesty (binding, inherited from ui-core): the wake-unavailable banner says exactly
// `wake unavailable` — never "reconnecting", never a retry spinner; the turn caption renders ONLY
// from a supplied boolean (`undefined` renders nothing, never a guessed "idle"); the six source
// branches keep loading honesty (`loading` never renders `(no events)`; missing/unaddressable/
// failed are distinct); foreign transcript segments appear ONLY behind the disclosure, each
// captioned and separated — never blended into the selected session's log.

import { useEffect, useRef, useState } from "react";
import {
  TERM_CLASS,
  TERM_CLASSES,
  TERM_NO_EVENTS_COPY,
  TERM_STALE_COPY,
  TERM_STOP_KEY_HINT,
  TERM_STOP_LABEL,
  TERM_WAKE_UNAVAILABLE_COPY,
  currentWakeRows,
  expandLabel,
  historySegmentCaption,
  historyToggleLabel,
  isExpandable,
  noiseShow,
  ROW_SCOPE,
  scopedRowKeys,
  segmentKeys,
  shouldStopOnKey,
  sourceRows,
  stopButtonClass,
  termRowClass,
  termTitleText,
  transcriptView,
  turnCaption,
  visibleRows,
  type TermRow,
  type TermSource,
  type TranscriptSegment,
} from "@mythicalos/ui-core/logic";

export {
  TERM_CLASS,
  TERM_CLASSES,
  TERM_STALE_COPY,
  TERM_WAKE_UNAVAILABLE_COPY,
  transcriptView,
  type TermRow,
  type TermRowKind,
  type TermSource,
  type TermView,
  type TranscriptSegment,
} from "@mythicalos/ui-core/logic";

export interface TerminalProps {
  /** The sole transcript input. All six arms are rendered by ui-core's `transcriptView`. */
  source: TermSource;
  /** Title-line text left of ` · tail · noise {on|off}` (e.g. `jacob.jsonl`). */
  name?: string;
  /** The noise FILTER: on ⇒ noise rows are HIDDEN and the title reads `noise on`. */
  noiseFilterEnabled?: boolean;
  /** Omit for a read-only pane — the title then renders as a caption, not a dead button. */
  onToggleNoise?(): void;
  /** Client-synthetic rows appended after the transcript (e.g. an interrupt marker). */
  localRows?: readonly TermRow[];
  /** Render only from the last `boundary` row on (the current wake). */
  currentWakeOnly?: boolean;
  history?: readonly TranscriptSegment[];
  /** Shows the `wake unavailable` banner. Independent of the transcript branches. */
  wakeUnavailable?: boolean;
  /** The blinking stream caret. */
  caret?: boolean;
  /** Supplied truth only — `undefined` renders NO caption rather than guessing. */
  turnInFlight?: boolean;
  /** Omit to render no stop control at all. */
  onStopTurn?(): void;
  /** A stop is already in flight: the control is disabled and Ctrl-C is ignored. */
  stopBusy?: boolean;
  /** VISUAL weight for the stop control only — never a state claim. */
  stopProminent?: boolean;
}

function RowView(props: { row: TermRow; expanded: boolean; onToggle(): void }) {
  const { row } = props;
  const label = row.label ? <span className={TERM_CLASSES.label}>{row.label}</span> : null;
  if (!isExpandable(row)) {
    return (
      <div className={termRowClass(row.kind)}>
        {label}
        {label ? " " : null}
        {row.text}
      </div>
    );
  }
  return (
    <div className={termRowClass(row.kind)}>
      <button type="button" className={TERM_CLASSES.head} aria-expanded={props.expanded} onClick={props.onToggle}>
        {label}
        {label ? " " : null}
        {row.text} <span className={TERM_CLASSES.expand}>{expandLabel(props.expanded)}</span>
      </button>
      {props.expanded ? <pre className={TERM_CLASSES.detail}>{row.detail}</pre> : null}
    </div>
  );
}

/**
 * A keyed run of rows. `scopedRowKeys` namespaces every key under its scope, so expand state can
 * never leak between the transcript, the local rows and a history segment — not even when a caller
 * supplies an id that looks like another scope's prefix.
 */
function RowList(props: {
  rows: readonly TermRow[];
  scope: readonly string[];
  expanded: Set<string>;
  onToggle(key: string): void;
}) {
  const keys = scopedRowKeys(props.scope, props.rows);
  return (
    <>
      {props.rows.map((row, i) => {
        const key = keys[i]!;
        return <RowView key={key} row={row} expanded={props.expanded.has(key)} onToggle={() => props.onToggle(key)} />;
      })}
    </>
  );
}

export function Terminal(props: TerminalProps) {
  const { source, noiseFilterEnabled = false } = props;
  const history = props.history ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const stopAvailable = props.onStopTurn !== undefined;
  const { onStopTurn, stopBusy } = props;

  // Focused Ctrl-C → stop-turn. The predicate (key-repeat drop, selection guard, focus guard) is
  // ui-core's; the availability + in-flight guards live here. Effects do not run under SSR.
  useEffect(() => {
    if (!stopAvailable) return;
    const onKey = (e: KeyboardEvent) => {
      if (stopBusy) return;
      const sel = window.getSelection?.()?.toString() ?? "";
      const pane = paneRef.current;
      const focused = !!pane && pane.contains(document.activeElement);
      if (shouldStopOnKey(e, sel, focused)) {
        e.preventDefault();
        onStopTurn?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopAvailable, onStopTurn, stopBusy]);

  const view = transcriptView(source);
  const showNoise = noiseShow(noiseFilterEnabled);
  const allRows = props.currentWakeOnly ? currentWakeRows(sourceRows(source)) : sourceRows(source);
  const rows = view.kind === "log" ? visibleRows(allRows, showNoise) : [];
  const localRows = view.kind === "log" ? visibleRows(props.localRows ?? [], showNoise) : [];
  const emptyLog = view.kind === "log" && rows.length === 0 && localRows.length === 0;
  const segKeys = segmentKeys(history);
  const titleText = termTitleText(props.name, noiseFilterEnabled);
  const caption = turnCaption(props.turnInFlight);

  return (
    <div className={TERM_CLASS}>
      <div className={TERM_CLASSES.titlebar}>
        <span className={TERM_CLASSES.lights} aria-hidden="true">
          <span className={TERM_CLASSES.lightRed} />
          <span className={TERM_CLASSES.lightAmber} />
          <span className={TERM_CLASSES.lightGreen} />
        </span>
        {props.onToggleNoise ? (
          <button
            type="button"
            className={TERM_CLASSES.noiseToggle}
            aria-pressed={noiseFilterEnabled}
            onClick={props.onToggleNoise}
          >
            {titleText}
          </button>
        ) : (
          <span className={TERM_CLASSES.staticTitle}>{titleText}</span>
        )}
        <span className={TERM_CLASSES.titleRight}>
          {caption !== null ? (
            props.turnInFlight ? (
              <span className={TERM_CLASSES.turn}>
                <span className={TERM_CLASSES.turnDot} aria-hidden="true" />
                {caption}
              </span>
            ) : (
              <span className={TERM_CLASSES.idle}>{caption}</span>
            )
          ) : null}
          {stopAvailable ? (
            <button
              type="button"
              className={stopButtonClass(!!props.stopProminent)}
              disabled={props.stopBusy}
              onClick={props.onStopTurn}
            >
              {TERM_STOP_LABEL} <span className={TERM_CLASSES.stopKey}>{TERM_STOP_KEY_HINT}</span>
            </button>
          ) : null}
        </span>
      </div>
      <div ref={paneRef} className={TERM_CLASSES.body} tabIndex={0}>
        {props.wakeUnavailable ? (
          <div className={TERM_CLASSES.banner}>
            <span className={TERM_CLASSES.bannerDot} aria-hidden="true" />
            {TERM_WAKE_UNAVAILABLE_COPY}
          </div>
        ) : null}
        {view.kind === "log" && view.stale ? (
          <div className={TERM_CLASSES.banner}>
            <span className={TERM_CLASSES.bannerDot} aria-hidden="true" />
            {TERM_STALE_COPY}
          </div>
        ) : null}
        {history.length > 0 ? (
          <button type="button" className={TERM_CLASSES.more} onClick={() => setShowHistory((s) => !s)}>
            {historyToggleLabel(showHistory, history.length)}
          </button>
        ) : null}
        {showHistory
          ? history.map((seg, si) => (
              // keyed by the segment's own identity, not its position, so reordering the list moves
              // neither the rendered element nor its rows' expand state
              <div className={TERM_CLASSES.segment} key={segKeys[si]}>
                <div className={TERM_CLASSES.segmentCaption}>{seg.caption ?? historySegmentCaption(seg.id)}</div>
                <RowList
                  rows={visibleRows(seg.rows, showNoise)}
                  scope={[ROW_SCOPE.history, segKeys[si]!]}
                  expanded={expanded}
                  onToggle={toggle}
                />
              </div>
            ))
          : null}
        {view.kind === "state" ? <div className={TERM_CLASSES.state}>{view.copy}</div> : null}
        {emptyLog ? <div className={TERM_CLASSES.state}>{TERM_NO_EVENTS_COPY}</div> : null}
        <RowList rows={rows} scope={[ROW_SCOPE.transcript]} expanded={expanded} onToggle={toggle} />
        <RowList rows={localRows} scope={[ROW_SCOPE.local]} expanded={expanded} onToggle={toggle} />
        {props.caret ? <span className={TERM_CLASSES.caret} aria-hidden="true" /> : null}
      </div>
    </div>
  );
}
