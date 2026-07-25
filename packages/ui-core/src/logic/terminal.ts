// @mythicalos/ui-core — the terminal half of the terminal set (ds/components-terminal, spec v2):
// the transcript row model, source→view resolution, segmentation, and every user-visible string.
// Pure — no framework, no DOM.
//
// TOKEN RULE 3 (ds/tokens): "Terminal surfaces always use the --my-term-* set, regardless of app
// theme." The terminal is heritage-dark in BOTH themes. That is enforced in styles.css by the
// `.my-term` block, which re-points the theme-flipping locals onto the fixed --my-term-* palette
// for the whole subtree — `TERM_CLASS` is the single class that carries it, so a binding cannot
// render a terminal that follows the app theme. The send bar and the queue rows are app chrome and
// DO follow the theme (matching the design card, where both are drawn on the light surface).

/** The one class that carries the always-heritage-dark surface (token rule 3). */
export const TERM_CLASS = "my-term";

/**
 * Transcript row kinds. Generic on purpose — this package knows nothing about any product's
 * event wire format; a consumer maps its own stream onto these.
 *  - `boundary` — a wake/session marker; also the segmentation anchor (`currentWakeRows`).
 *  - `local`    — a CLIENT-SYNTHETIC row (e.g. an interrupt marker). Deliberately its own kind so
 *                 UI-originated rows can never masquerade as `system` output from the far side.
 */
export type TermRowKind =
  | "assistant"
  | "user"
  | "tool"
  | "result"
  | "system"
  | "boundary"
  | "local"
  | "dim";

export const TERM_ROW_KINDS: readonly TermRowKind[] = [
  "assistant",
  "user",
  "tool",
  "result",
  "system",
  "boundary",
  "local",
  "dim",
];

export interface TermRow {
  kind: TermRowKind;
  /** The collapsed row's text. */
  text: string;
  /** Optional leading label (`assistant`, a tool name, …). */
  label?: string;
  /** Optional full body revealed by the row's expand affordance. */
  detail?: string;
  /** Stable key for expand state; the row index is used when absent. */
  id?: string;
  /** Noise rows are hidden unless noise is shown (see `noiseShow` / `visibleRows`). */
  noise?: boolean;
}

/** Row class derivation — base + kind modifier. */
export function termRowClass(kind: TermRowKind): string {
  return `my-term__row my-term__row--${kind}`;
}

/** A row is expandable exactly when the caller gave it a body to reveal. */
export function isExpandable(row: TermRow): boolean {
  return typeof row.detail === "string" && row.detail.length > 0;
}

/** Stable expand key for a row — its own id, else its position. */
export function rowKey(row: TermRow, index: number): string {
  return row.id ?? String(index);
}

// ── segmentation ──

/** Index of the LAST `boundary` row, or -1 when the transcript carries none. */
export function lastBoundaryIndex(rows: readonly TermRow[]): number {
  const arr = Array.isArray(rows) ? rows : [];
  let idx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]?.kind === "boundary") idx = i;
  }
  return idx;
}

/**
 * Only the current wake: from the LAST `boundary` row (that row included, as the "you woke here"
 * header) onward. With NO boundary the whole transcript IS one wake, so every row is returned —
 * segmentation never silently blanks a log that simply carries no markers.
 */
export function currentWakeRows(rows: readonly TermRow[]): readonly TermRow[] {
  const arr = Array.isArray(rows) ? rows : [];
  const idx = lastBoundaryIndex(arr);
  return idx >= 0 ? arr.slice(idx) : arr;
}

/**
 * The renderer option is INVERTED relative to the label: the noise FILTER being enabled means noise
 * is HIDDEN, and the title line then reads `noise on` (the filter is on).
 */
export function noiseShow(noiseFilterEnabled: boolean): boolean {
  return !noiseFilterEnabled;
}

/** Drop `noise` rows unless noise is being shown. */
export function visibleRows(rows: readonly TermRow[], showNoise: boolean): readonly TermRow[] {
  const arr = Array.isArray(rows) ? rows : [];
  return showNoise ? arr : arr.filter((r) => !r?.noise);
}

// ── source → view (loading honesty) ──

/**
 * The transcript's input. Six arms, four of which are DISTINCT unavailable states — collapsing any
 * of them would make the pane claim knowledge it does not have.
 */
export type TermSource =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "unaddressable" }
  | { kind: "failed" }
  | { kind: "ready"; rows: readonly TermRow[] }
  | { kind: "stale"; rows: readonly TermRow[] };

export const TERM_LOADING_COPY = "Loading transcript…";
/** ONE neutral string for "the read succeeded and there is no transcript" — it never speculates
 *  about lifecycle ("not started yet", "already cleaned up", …). */
export const TERM_MISSING_COPY = "No transcript is available for this session.";
export const TERM_UNADDRESSABLE_COPY = "This transcript can't be attributed to this session.";
export const TERM_FAILED_COPY = "The transcript could not be loaded.";
/** Stale banner. NO retry/reconnect claim — the design card's "connection lost · retrying (2/5)"
 *  promises a recovery loop this component does not run. */
export const TERM_STALE_COPY = "Transcript disconnected — showing the last received log.";
/** Rendered when a live log has zero rows. Reachable ONLY from `ready`/`stale` (see
 *  `transcriptView`) — a `loading` pane never renders it. */
export const TERM_NO_EVENTS_COPY = "(no events)";

/**
 * HONESTY INVARIANT (binding, do not reword): the wake-unavailable banner says exactly that. Never
 * "reconnecting", never "retrying (n/m)", never a spinner or countdown implying an automatic
 * recovery is under way. The component makes no recovery attempt, so it must not look like one.
 */
export const TERM_WAKE_UNAVAILABLE_COPY = "wake unavailable";

export type TermView = { kind: "log"; stale: boolean } | { kind: "state"; copy: string };

/**
 * HONESTY INVARIANT (binding): only `ready`/`stale` render a log; `stale` additionally flags the
 * disconnected banner. `loading` renders the loading copy and NEVER `(no events)` — an unfinished
 * read is not an empty transcript. `missing` / `unaddressable` / `failed` are three separate
 * unavailable states with three separate messages.
 */
export function transcriptView(source: TermSource): TermView {
  switch (source.kind) {
    case "ready":
      return { kind: "log", stale: false };
    case "stale":
      return { kind: "log", stale: true };
    case "loading":
      return { kind: "state", copy: TERM_LOADING_COPY };
    case "missing":
      return { kind: "state", copy: TERM_MISSING_COPY };
    case "unaddressable":
      return { kind: "state", copy: TERM_UNADDRESSABLE_COPY };
    case "failed":
      return { kind: "state", copy: TERM_FAILED_COPY };
  }
}

/** The source's rows when it carries any (`ready`/`stale`), else `[]`. */
export function sourceRows(source: TermSource): readonly TermRow[] {
  return source.kind === "ready" || source.kind === "stale" ? source.rows : [];
}

// ── title bar ──

/** `{name} · tail · noise {on|off}`; a nameless transcript falls back to `transcript`. */
export function termTitleText(name: string | undefined, noiseFilterEnabled: boolean): string {
  const trimmed = name?.trim();
  return `${trimmed ? trimmed : "transcript"} · tail · noise ${noiseFilterEnabled ? "on" : "off"}`;
}

export const TURN_IN_FLIGHT_COPY = "turn in flight";
export const TURN_IDLE_COPY = "idle · no turn in flight";

/**
 * HONESTY INVARIANT: the turn caption rides supplied truth only. `undefined` (the caller does not
 * know) renders NOTHING — the pane never guesses a turn state, and in particular never shows "idle"
 * merely because it was told nothing.
 */
export function turnCaption(turnInFlight: boolean | undefined): string | null {
  if (turnInFlight === true) return TURN_IN_FLIGHT_COPY;
  if (turnInFlight === false) return TURN_IDLE_COPY;
  return null;
}

/**
 * NEUTRAL history-toggle copy. Transcript files append generations in FILE order, so a foreign
 * group can include NEWER sessions when the selected one is an older retained session — "earlier
 * sessions" would be untruthful. The copy therefore only states that other sessions share this
 * transcript.
 */
export function historyToggleLabel(show: boolean, count: number): string {
  return show ? "↓ hide other sessions" : `↑ show other sessions in this transcript (${count})`;
}

/** Caption for one foreign transcript segment (gap: never blended into the selected log). */
export function historySegmentCaption(id: string): string {
  return `session ${id ? id : "—"}`;
}

// ── keyboard ──

/**
 * Focused-terminal Ctrl-C → stop-turn. Requires: `c` + ctrl, NOT a key-repeat (holding Ctrl-C must
 * not fire a burst), NO active text selection (so copy still works), and the pane focused.
 */
export function shouldStopOnKey(
  e: { key?: unknown; ctrlKey?: unknown; repeat?: unknown } | null,
  selectionText: string,
  paneHasFocus: boolean,
): boolean {
  return !!e && e.key === "c" && e.ctrlKey === true && e.repeat !== true && selectionText.length === 0 && paneHasFocus;
}

export const TERM_STOP_LABEL = "◼ stop";
export const TERM_STOP_KEY_HINT = "^C";

/** Stop control class; `is-prominent` is a VISUAL weight only, never a state claim. */
export function stopButtonClass(prominent: boolean): string {
  return prominent ? "my-term__stop is-prominent" : "my-term__stop";
}
