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
 * Every structural class the pane renders. Named here — not typed literally in a binding — so the
 * Preact and React bindings cannot drift, and so the stylesheet guard can enumerate the real
 * surface instead of a hand-copied list.
 */
export const TERM_CLASSES = {
  pane: TERM_CLASS,
  titlebar: "my-term__titlebar",
  lights: "my-term__lights",
  light: "my-term__light",
  lightRed: "my-term__light my-term__light--r",
  lightAmber: "my-term__light my-term__light--a",
  lightGreen: "my-term__light my-term__light--g",
  noiseToggle: "my-term__noise",
  staticTitle: "my-term__title",
  titleRight: "my-term__tb-right",
  turn: "my-term__turn",
  turnDot: "my-term__turn-dot",
  idle: "my-term__idle",
  stopKey: "my-term__stop-key",
  body: "my-term__body",
  banner: "my-term__banner",
  bannerDot: "my-term__banner-dot",
  state: "my-term__state",
  label: "my-term__label",
  head: "my-term__head",
  expand: "my-term__expand",
  detail: "my-term__detail",
  block: "my-term__block",
  blockPre: "my-term__blockpre",
  copy: "my-term__copy",
  more: "my-term__more",
  segment: "my-term__hist",
  segmentCaption: "my-term__hist-cap",
  caret: "my-term__caret",
} as const;

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
  /**
   * Structured report block: `text` renders inside a preformatted inset panel — whitespace and
   * hand-alignment preserved exactly, horizontal overflow scrolled, never wrapped — with a copy
   * affordance. A block row is NOT expandable: `block` takes precedence over `detail`, which is
   * ignored when this is set (see `isExpandable`). The row keeps its `kind` class and its
   * optional `label`.
   */
  block?: boolean;
}

/**
 * One foreign transcript segment — another session's rows sharing this transcript. Shown ONLY
 * behind the disclosure, captioned with its own immutable id and visually separated; never blended
 * into the selected session's log.
 */
export interface TranscriptSegment {
  id: string;
  /** Overrides the default `session {id}` caption. */
  caption?: string;
  rows: readonly TermRow[];
}

/** Row class derivation — base + kind modifier. */
export function termRowClass(kind: TermRowKind): string {
  return `my-term__row my-term__row--${kind}`;
}

/** A block row renders its `text` preformatted (see `TermRow.block`). Normalized here so a JS
 *  caller passing a truthy non-boolean cannot make the two bindings disagree. */
export function isBlockRow(row: TermRow): boolean {
  return row.block === true;
}

/** A row is expandable exactly when the caller gave it a body to reveal — unless it is a block
 *  row: `block` takes precedence over `detail`, so a block row never grows an expand affordance. */
export function isExpandable(row: TermRow): boolean {
  return !isBlockRow(row) && typeof row.detail === "string" && row.detail.length > 0;
}

/** Label on a row's expand affordance, per its current state. */
export const ROW_EXPAND_LABEL = "(expand)";
export const ROW_COLLAPSE_LABEL = "(collapse)";
export function expandLabel(expanded: boolean): string {
  return expanded ? ROW_COLLAPSE_LABEL : ROW_EXPAND_LABEL;
}

// ── block copy affordance ──

/** Resting label on a block row's copy control. */
export const TERM_COPY_LABEL = "copy";
/** Transient label after a clipboard write that actually resolved. */
export const TERM_COPIED_LABEL = "copied ✓";
/** The copy control's resting accessible name. */
export const TERM_COPY_ARIA = "Copy to clipboard";
/** The copy control's accessible name while the copied feedback shows. The visible label and the
 *  accessible name flip TOGETHER (`copyLabel`/`copyAria`), so assistive tech announces the same
 *  state a sighted reader sees — never a control whose name still offers what it just did. */
export const TERM_COPIED_ARIA = "Copied to clipboard";
/** How long the copied feedback stays on the control before it reverts. */
export const TERM_COPIED_REVERT_MS = 1500;

/** Visible label on a block row's copy control, per its current state. */
export function copyLabel(copied: boolean): string {
  return copied ? TERM_COPIED_LABEL : TERM_COPY_LABEL;
}

/** Accessible name on a block row's copy control — state-aware, in lockstep with `copyLabel`. */
export function copyAria(copied: boolean): string {
  return copied ? TERM_COPIED_ARIA : TERM_COPY_ARIA;
}

/** The clipboard shape the copy control requires — anything less is treated as absent. */
interface TermClipboardHost {
  navigator?: { clipboard?: { writeText?: (text: string) => unknown } };
}

/**
 * Resolves the copy control's clipboard from `host` (a binding passes `globalThis`), or `null`
 * when it is absent — the control then renders NOTHING at all, rather than a button that cannot
 * work. `navigator.clipboard` is not a given: it exists only in a secure context, and every
 * product in the family is reachable over plain http on a LAN address, where the whole object is
 * `undefined`. The returned writer resolves to whether the write ACTUALLY happened — a rejected
 * write (unfocused document, denied permission, a hostile shim) resolves `false`, so a binding
 * never shows "copied ✓" for a clipboard that stayed empty.
 */
export function termClipboardWriter(host: unknown): ((text: string) => Promise<boolean>) | null {
  const clipboard = (host as TermClipboardHost | null | undefined)?.navigator?.clipboard;
  const writeText = clipboard?.writeText;
  if (clipboard === undefined || typeof writeText !== "function") return null;
  return async (text: string) => {
    try {
      // invoked ON the clipboard object on purpose: `writeText` is a native method and throws if
      // it is torn off its receiver
      await writeText.call(clipboard, text);
      return true;
    } catch {
      return false;
    }
  };
}

// ── follow-tail scroll ──

/** How close to the bottom (px) still counts as "at the tail" — the follow-resume window. */
export const FOLLOW_TAIL_THRESHOLD_PX = 48;

/**
 * Whether a scroll position counts as at (or near) the bottom of its pane. This is the whole
 * follow-tail policy: while the reader is near the bottom the pane follows new output; once they
 * scroll up past `threshold` it never force-scrolls; scrolling back within `threshold` resumes
 * following. Degenerate geometry — content no taller than the viewport, or a non-finite
 * measurement — counts as near: a pane that cannot scroll is at its own bottom, and following is
 * the safe default.
 */
export function nearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = FOLLOW_TAIL_THRESHOLD_PX,
): boolean {
  const gap = scrollHeight - clientHeight - scrollTop;
  if (!Number.isFinite(gap)) return true;
  return gap <= threshold;
}

/**
 * ONE revision key covering everything the terminal body renders. A binding's follow-tail pin
 * effect depends on this single derived value instead of enumerating raw inputs at the effect —
 * an enumeration has to be maintained by hand at every call site, and in practice it silently
 * dropped cases (the current-wake filter and the expand state), leaving the pane un-pinned on
 * content changes it should follow. Any change that can move the bottom edge changes the key:
 * rows appended OR a tail row growing in place mid-stream (hence the character sums, not just
 * counts — a streaming update often grows the last row without adding one), local rows, history
 * segments and their disclosure, both banners, the caret, the current-wake and noise filters,
 * and how many detail rows are expanded. Cheap by construction: lengths, counts and flags only —
 * no hashing, no serialization of row text. Pure, so it is SSR-safe to compute during render.
 */
export function termContentRevision(input: {
  view: TermView;
  rows: readonly TermRow[];
  localRows: readonly TermRow[];
  history: readonly TranscriptSegment[];
  showHistory: boolean;
  wakeUnavailable: boolean;
  caret: boolean;
  currentWakeOnly: boolean;
  noiseFilter: boolean;
  expandedCount: number;
}): string {
  // count + character sum (text AND detail, so an expanded body growing in place counts too)
  const run = (rows: readonly TermRow[]): string =>
    `${rows.length}.${rows.reduce((chars, row) => chars + row.text.length + (row.detail?.length ?? 0), 0)}`;
  const view =
    input.view.kind === "log" ? (input.view.stale ? "log-stale" : "log") : `state.${input.view.copy.length}`;
  return [
    view,
    run(input.rows),
    run(input.localRows),
    `${input.history.length}.${input.history.reduce((n, seg) => n + seg.rows.length, 0)}`,
    input.showHistory ? "h1" : "h0",
    input.wakeUnavailable ? "w1" : "w0",
    input.caret ? "c1" : "c0",
    input.currentWakeOnly ? "k1" : "k0",
    input.noiseFilter ? "n1" : "n0",
    `x${input.expandedCount}`,
  ].join("|");
}

/** Stable expand key for a single row — its own id, else its position. */
export function rowKey(row: TermRow, index: number): string {
  return row.id ?? String(index);
}

/**
 * Dedupe preferred keys into unique ones, preserving the FIRST occurrence verbatim so a caller's
 * own id keeps identifying the same thing. Repeats take a `#n` disambiguator; the loop (rather than
 * a counter) also covers a literal id that collides with a disambiguator already handed out.
 */
export function uniqueKeys(preferred: readonly string[]): string[] {
  const arr = Array.isArray(preferred) ? preferred : [];
  const used = new Set<string>();
  return arr.map((base) => {
    let key = base;
    for (let n = 1; used.has(key); n++) key = `${base}#${n}`;
    used.add(key);
    return key;
  });
}

/**
 * Collision-free keys for one list of rows. `id` is honored so expand state survives rows being
 * prepended, but ids are NOT trusted to be unique: a repeated id would otherwise make two rows
 * expand together and hand the renderer duplicate sibling keys.
 */
export function rowKeys(rows: readonly TermRow[]): string[] {
  const arr = Array.isArray(rows) ? rows : [];
  return uniqueKeys(arr.map((row, index) => rowKey(row!, index)));
}

/**
 * Identity for each foreign segment: its own id where it has one, its position otherwise, deduped.
 * Using the id (not the position) is what keeps a segment's expand state attached to the segment
 * when the list is reordered.
 */
export function segmentKeys(segments: readonly TranscriptSegment[]): string[] {
  const arr = Array.isArray(segments) ? segments : [];
  return uniqueKeys(arr.map((seg, index) => (seg?.id ? seg.id : String(index))));
}

/** The row scopes a pane renders. Each is a distinct namespace for expand state. */
export const ROW_SCOPE = {
  transcript: "t",
  local: "l",
  history: "h",
} as const;

/** `%` and `|` are the escape and the delimiter, so both must be escaped inside a part. */
function escapePart(part: string): string {
  return part.replace(/%/g, "%25").replace(/\|/g, "%7C");
}

/**
 * Namespace a list's row keys under a scope so expand state can NEVER leak between the transcript,
 * the client-synthetic local rows and a history segment.
 *
 * A naive `${scope}:${key}` prefix is not enough: a transcript row whose id is literally `local:a`
 * would then share state with the local row `a`. Every part is escaped before being joined, so the
 * mapping from (scope parts, row key) to string is injective — two different tuples cannot produce
 * the same key, whatever ids the caller supplies.
 */
export function scopedRowKeys(scope: readonly string[], rows: readonly TermRow[]): string[] {
  const prefix = scope.map(escapePart).join("|");
  return rowKeys(rows).map((key) => `${prefix}|${escapePart(key)}`);
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

/**
 * DEVIATION FROM THE DESIGN CARD (deliberate, carried over from the shipped implementation this was
 * extracted from): the card draws a light-surface "Stop turn" button beside the send bar. The
 * shipped pane instead puts the stop control in the terminal's own title bar, right of the turn
 * indicator, labelled `◼ stop ^C`. Two reasons it stays that way: the control belongs to the
 * transcript it interrupts (the send bar can be disabled while a turn is still running), and the
 * card's own caption already documents the `^C` keybinding, which the label surfaces. The colour
 * treatment follows token rule 3 — inside the terminal the control wears the --my-term-* palette,
 * not the app's danger red, which flips with the app theme.
 */
export const TERM_STOP_LABEL = "◼ stop";
export const TERM_STOP_KEY_HINT = "^C";

/** Stop control class; `is-prominent` is a VISUAL weight only, never a state claim. */
export function stopButtonClass(prominent: boolean): string {
  return prominent ? "my-term__stop is-prominent" : "my-term__stop";
}
