// test/logic/terminal.test.ts — the terminal set's pure core (ds/components-terminal v2):
// terminal · queue-row · send-bar.
//
// Beyond ordinary correctness, this file is the regression suite for the SIX honesty invariants the
// extraction had to carry out of the product intact. Each is stated where it is asserted; they are
// design, not product logic, which is why they live in this package and not in a consumer.

import { describe, expect, test } from "bun:test";
import {
  DEFAULT_DELIVERY_CLASS,
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  QUEUE_CANCEL_ASK,
  QUEUE_EMPTY_COPY,
  QUEUE_LOADING_COPY,
  QUEUE_STALE_COPY,
  QUEUE_UNAVAILABLE_COPY,
  FOLLOW_TAIL_THRESHOLD_PX,
  SEND_DISABLED_FALLBACK,
  SEND_PLACEHOLDER,
  TERM_CLASS,
  TERM_CLASSES,
  TERM_COPIED_ARIA,
  TERM_COPIED_LABEL,
  TERM_COPIED_REVERT_MS,
  TERM_COPY_ARIA,
  TERM_COPY_LABEL,
  TERM_FAILED_COPY,
  TERM_LOADING_COPY,
  TERM_MISSING_COPY,
  TERM_NO_EVENTS_COPY,
  TERM_ROW_KINDS,
  TERM_SPAN_KINDS,
  TERM_STALE_COPY,
  TERM_UNADDRESSABLE_COPY,
  TERM_WAKE_UNAVAILABLE_COPY,
  TURN_IDLE_COPY,
  TURN_IN_FLIGHT_COPY,
  canCancelRow,
  canSend,
  cancelReducer,
  clearDraftOnSend,
  copyAria,
  copyLabel,
  isFreshSource,
  currentWakeRows,
  deliveryClassButtonClass,
  expandLabel,
  deliveryClassLabel,
  historySegmentCaption,
  historyToggleLabel,
  isBlockRow,
  isExpandable,
  isTermSpan,
  keyAction,
  lastBoundaryIndex,
  makeSendGate,
  nearBottom,
  noiseShow,
  queueBadgeClass,
  queueBadgeLabel,
  queueRowClass,
  queueStatusLabel,
  queueView,
  resolveSend,
  ROW_SCOPE,
  rowKey,
  rowKeys,
  rowSpans,
  scopedRowKeys,
  segmentKeys,
  sendBarClass,
  sendPlaceholder,
  shouldDisarmCancel,
  shouldStopOnKey,
  showDeliveryHint,
  sourceRows,
  spansText,
  stopButtonClass,
  termClipboardWriter,
  termContentRevision,
  termRowClass,
  termTitleText,
  transcriptView,
  turnCaption,
  unavailableText,
  uniqueKeys,
  visibleRows,
  type QueueItem,
  type QueueItemStatus,
  type QueueSource,
  type QueueUnavailableReason,
  type TermRow,
  type TermSource,
  type TermSpan,
  type TermView,
  type TranscriptSegment,
} from "../../src/index.ts";

const ALL_STATUSES: QueueItemStatus[] = ["queued", "leased", "delivered", "canceled"];
const ALL_REASONS: QueueUnavailableReason[] = ["unsupported", "error", "unaddressable"];

function item(over: Partial<QueueItem> = {}): QueueItem {
  return { id: "e1", cls: "asap", body: "re-run the fold matrix", status: "queued", ...over };
}
function row(over: Partial<TermRow> = {}): TermRow {
  return { kind: "assistant", text: "seam refactor green", ...over };
}

/** Every user-visible string this package can produce, for the copy-level scans below. */
function allCopy(): string[] {
  return [
    DELIVERY_HINT,
    SEND_PLACEHOLDER,
    SEND_DISABLED_FALLBACK,
    QUEUE_EMPTY_COPY,
    QUEUE_STALE_COPY,
    QUEUE_LOADING_COPY,
    QUEUE_CANCEL_ASK,
    ...ALL_REASONS.map((r) => QUEUE_UNAVAILABLE_COPY[r]),
    TERM_LOADING_COPY,
    TERM_MISSING_COPY,
    TERM_UNADDRESSABLE_COPY,
    TERM_FAILED_COPY,
    TERM_STALE_COPY,
    TERM_NO_EVENTS_COPY,
    TERM_WAKE_UNAVAILABLE_COPY,
    TERM_COPY_LABEL,
    TERM_COPIED_LABEL,
    TERM_COPY_ARIA,
    TERM_COPIED_ARIA,
    TURN_IN_FLIGHT_COPY,
    TURN_IDLE_COPY,
    historyToggleLabel(true, 2),
    historyToggleLabel(false, 2),
    sendPlaceholder(false),
    sendPlaceholder(false, undefined, "Jacob"),
    sendPlaceholder(true),
    termTitleText("jacob.jsonl", true),
    termTitleText(undefined, false),
  ];
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 1 — the terminal is ALWAYS heritage-dark, in both themes (ds/tokens rule 3).
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 1 — the terminal surface is theme-independent", () => {
  test("there is exactly ONE terminal surface class, and it takes no theme argument", () => {
    expect(TERM_CLASS).toBe("my-term");
    // A theme-conditional surface would have to be derived by a function; the fact that this is a
    // constant is the guarantee that no binding can render a light terminal.
    expect(typeof TERM_CLASS).toBe("string");
  });

  test("no row class encodes a theme — kind is the only axis", () => {
    for (const kind of TERM_ROW_KINDS) {
      expect(termRowClass(kind)).toBe(`my-term__row my-term__row--${kind}`);
    }
    expect(new Set(TERM_ROW_KINDS.map(termRowClass)).size).toBe(TERM_ROW_KINDS.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 2 — the send bar's honest delivery hint. "ASAP interrupts" is FALSE.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 2 — delivery hint tells the truth about turn boundaries", () => {
  test("the hint is the exact, corrected line", () => {
    expect(DELIVERY_HINT).toBe("ASAP takes the first turn gap · ON-DONE waits for full idle.");
  });

  test("NO user-visible string in this package ever claims delivery interrupts anything", () => {
    // The design card's older wording ("ASAP interrupts · ON-DONE waits") is false: delivery always
    // waits for a turn boundary. This scan is what stops it being pasted back in.
    const offenders = allCopy().filter((s) => /interrupt/i.test(s));
    expect(offenders).toEqual([]);
  });

  test("the hint renders only where the controls are usable", () => {
    expect(showDeliveryHint(false)).toBe(true);
    expect(showDeliveryHint(true)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 3 — queue empty copy is capability-neutral, and only `ok` + zero items reaches it.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 3 — queue source→view honesty", () => {
  test("the empty copy reports the READ, and claims nothing about a store or operations", () => {
    expect(QUEUE_EMPTY_COPY).toBe("The queue read returned no records.");
    // the design card's line — "queue empty — deliveries land here by class (ASAP interrupts …)" —
    // asserts a store AND the false interrupt semantics; none of its claims may survive
    expect(QUEUE_EMPTY_COPY).not.toMatch(/queue empty/i);
    expect(QUEUE_EMPTY_COPY).not.toMatch(/land here/i);
    expect(QUEUE_EMPTY_COPY).not.toMatch(/interrupt/i);
    expect(QUEUE_EMPTY_COPY).not.toMatch(/nothing (is )?queued/i);
  });

  test("`loading` renders the loading state and NEVER the empty copy", () => {
    const view = queueView({ kind: "loading" });
    expect(view).toEqual({ kind: "state", copy: QUEUE_LOADING_COPY });
    expect(view.kind).not.toBe("empty");
  });

  test("`ok` + zero items is the ONLY arm that reaches `empty`", () => {
    const sources: QueueSource[] = [
      { kind: "loading" },
      ...ALL_REASONS.map((reason): QueueSource => ({ kind: "unavailable", reason })),
      { kind: "ok", items: [item()] },
      { kind: "stale", items: [] },
      { kind: "stale", items: [item()] },
    ];
    for (const source of sources) expect(queueView(source).kind).not.toBe("empty");
    expect(queueView({ kind: "ok", items: [] })).toEqual({ kind: "empty", copy: QUEUE_EMPTY_COPY });
  });

  test("`stale` is its own state — a stale EMPTY list is a flagged list, never `empty`", () => {
    const view = queueView({ kind: "stale", items: [] });
    expect(view).toEqual({ kind: "list", items: [], staleCopy: QUEUE_STALE_COPY, fresh: false });
    const fresh = queueView({ kind: "ok", items: [item()] });
    expect(fresh).toEqual({ kind: "list", items: [item()], staleCopy: null, fresh: true });
  });

  test("only a completed successful read is FRESH — everything else suppresses cancel", () => {
    expect(isFreshSource({ kind: "ok", items: [] })).toBe(true);
    expect(isFreshSource({ kind: "stale", items: [item()] })).toBe(false);
    expect(isFreshSource({ kind: "loading" })).toBe(false);
    expect(isFreshSource({ kind: "unavailable", reason: "error" })).toBe(false);
    // the view carries the verdict, so a binding never re-derives it
    const stale = queueView({ kind: "stale", items: [item()] });
    expect(stale.kind === "list" && stale.fresh).toBe(false);
  });

  test("the stale banner promises no recovery", () => {
    expect(QUEUE_STALE_COPY).toBe("Queue disconnected — showing the last received list.");
    expect(QUEUE_STALE_COPY).not.toMatch(/reconnect|retry|retrying/i);
  });

  test("the three unavailable reasons stay pairwise DISTINCT", () => {
    const copies = ALL_REASONS.map((r) => QUEUE_UNAVAILABLE_COPY[r]);
    expect(new Set(copies).size).toBe(ALL_REASONS.length);
    for (const reason of ALL_REASONS) {
      const view = queueView({ kind: "unavailable", reason });
      expect(view).toEqual({ kind: "state", copy: QUEUE_UNAVAILABLE_COPY[reason] });
      // an unavailable queue never claims it read nothing
      expect(QUEUE_UNAVAILABLE_COPY[reason]).not.toBe(QUEUE_EMPTY_COPY);
    }
  });

  test("a caller may ADD detail to a reason — it is appended, never substituted", () => {
    const view = queueView(
      { kind: "unavailable", reason: "unsupported" },
      { unsupported: "The daemon is in server mode." },
    );
    expect(view).toEqual({
      kind: "state",
      copy: `${QUEUE_UNAVAILABLE_COPY.unsupported} The daemon is in server mode.`,
    });
    // the other reasons still resolve to their own defaults
    expect(queueView({ kind: "unavailable", reason: "error" }, { unsupported: "x" })).toEqual({
      kind: "state",
      copy: QUEUE_UNAVAILABLE_COPY.error,
    });
    // blank/absent detail leaves the base sentence untouched
    expect(unavailableText("error")).toBe(QUEUE_UNAVAILABLE_COPY.error);
    expect(unavailableText("error", "   ")).toBe(QUEUE_UNAVAILABLE_COPY.error);
  });

  test("NO detail map can make two reasons render the same copy", () => {
    // the adversarial case the append rule exists for: a caller trying to flatten every reason to
    // one message still cannot, because this package's own distinct sentence always leads
    const flatten = { unsupported: "Unavailable.", error: "Unavailable.", unaddressable: "Unavailable." };
    const copies = ALL_REASONS.map((reason) => {
      const view = queueView({ kind: "unavailable", reason }, flatten);
      return view.kind === "state" ? view.copy : "";
    });
    expect(new Set(copies).size).toBe(ALL_REASONS.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 4 — the cancel affordance exists only on `queued` AND only when the caller allows it.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 4 — cancel affordance", () => {
  test("only queued + caller-permitted is cancellable; every other combination is not", () => {
    for (const status of ALL_STATUSES) {
      for (const allowed of [true, false]) {
        expect(canCancelRow(status, allowed)).toBe(status === "queued" && allowed);
      }
    }
  });

  test("the two-step machine arms, confirms and disarms", () => {
    expect(cancelReducer({ armedId: null }, { type: "arm", id: "e1" })).toEqual({ armedId: "e1" });
    expect(cancelReducer({ armedId: "e1" }, { type: "confirm" })).toEqual({ armedId: null });
    expect(cancelReducer({ armedId: "e1" }, { type: "disarm" })).toEqual({ armedId: null });
    // arming a second row replaces the first — never two open asks
    expect(cancelReducer({ armedId: "e1" }, { type: "arm", id: "e2" })).toEqual({ armedId: "e2" });
  });

  test("an armed confirm never outlives its cancelability", () => {
    const queued: QueueSource = { kind: "ok", items: [item({ id: "e1", status: "queued" })] };
    expect(shouldDisarmCancel(null, true, queued)).toBe(false);
    expect(shouldDisarmCancel("e1", true, queued)).toBe(false);
    // permission lost
    expect(shouldDisarmCancel("e1", false, queued)).toBe(true);
    // the row left `queued`
    for (const status of ALL_STATUSES.filter((s) => s !== "queued")) {
      expect(shouldDisarmCancel("e1", true, { kind: "ok", items: [item({ id: "e1", status })] })).toBe(true);
    }
    // the row vanished
    expect(shouldDisarmCancel("e1", true, { kind: "ok", items: [item({ id: "e2" })] })).toBe(true);
    // the source stopped carrying items at all
    expect(shouldDisarmCancel("e1", true, { kind: "loading" })).toBe(true);
    expect(shouldDisarmCancel("e1", true, { kind: "unavailable", reason: "error" })).toBe(true);
    // a STALE source disarms even though it still carries the queued row: the row's status is
    // last-known data, so an arm held against it would aim a cancel at information we know is out
    // of date (the row is displayed, just never with a live cancel control)
    expect(shouldDisarmCancel("e1", true, { kind: "stale", items: [item({ id: "e1" })] })).toBe(true);
  });

  test("badge / row / status derivation", () => {
    expect(queueBadgeLabel("asap")).toBe("ASAP");
    expect(queueBadgeLabel("on-done")).toBe("ON-DONE");
    expect(queueBadgeClass("asap")).toBe("my-qbadge my-qbadge--asap");
    expect(queueBadgeClass("on-done")).toBe("my-qbadge my-qbadge--done");
    for (const status of ALL_STATUSES) {
      expect(queueRowClass(status, false)).toBe(`my-qrow my-qrow--${status}`);
      expect(queueRowClass(status, true)).toBe("my-qrow is-confirm");
      // the status label is verbatim — never a friendlier synonym that loses precision
      expect(queueStatusLabel(status)).toBe(status);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 5 — Enter=send, Shift/Alt-Enter=newline, IME composition suppressed.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 5 — send-bar keyboard semantics", () => {
  test("Enter sends", () => {
    expect(keyAction({ key: "Enter" })).toBe("send");
  });
  test("Shift-Enter and Alt-Enter insert a newline", () => {
    expect(keyAction({ key: "Enter", shiftKey: true })).toBe("newline");
    expect(keyAction({ key: "Enter", altKey: true })).toBe("newline");
  });
  test("an in-progress IME composition NEVER sends", () => {
    expect(keyAction({ key: "Enter", isComposing: true })).toBe("none");
    expect(keyAction({ key: "Enter", isComposing: true, shiftKey: true })).toBe("none");
  });
  test("any other key, and malformed input, is inert", () => {
    expect(keyAction({ key: "a" })).toBe("none");
    expect(keyAction(null)).toBe("none");
    expect(keyAction(undefined)).toBe("none");
    expect(keyAction({})).toBe("none");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 6 — the wake-unavailable banner says exactly that.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe("invariant 6 — wake-unavailable banner", () => {
  test("the copy is verbatim", () => {
    expect(TERM_WAKE_UNAVAILABLE_COPY).toBe("wake unavailable");
  });

  test("NO user-visible string in this package promises a reconnect or a retry", () => {
    // the design card's "connection lost · retrying (2/5)" promises a recovery loop this component
    // does not run; neither banner may imply one
    const offenders = allCopy().filter((s) => /reconnect|retrying|retry|\(\d+\/\d+\)/i.test(s));
    expect(offenders).toEqual([]);
  });
});

// ── transcript source → view (loading honesty) ──
describe("transcriptView — six distinct branches", () => {
  test("only ready/stale render a log, and stale flags itself", () => {
    expect(transcriptView({ kind: "ready", rows: [] })).toEqual({ kind: "log", stale: false });
    expect(transcriptView({ kind: "stale", rows: [] })).toEqual({ kind: "log", stale: true });
  });

  test("`loading` renders the loading copy and NEVER `(no events)`", () => {
    const view = transcriptView({ kind: "loading" });
    expect(view).toEqual({ kind: "state", copy: TERM_LOADING_COPY });
    expect(view.kind === "state" && view.copy).not.toBe(TERM_NO_EVENTS_COPY);
  });

  test("missing / unaddressable / failed are three DISTINCT unavailable states", () => {
    const copies = (["missing", "unaddressable", "failed"] as const).map((kind) => {
      const view = transcriptView({ kind });
      expect(view.kind).toBe("state");
      return view.kind === "state" ? view.copy : "";
    });
    expect(copies).toEqual([TERM_MISSING_COPY, TERM_UNADDRESSABLE_COPY, TERM_FAILED_COPY]);
    expect(new Set(copies).size).toBe(3);
    expect(new Set([...copies, TERM_LOADING_COPY, TERM_NO_EVENTS_COPY]).size).toBe(5);
  });

  test("sourceRows carries rows only where they exist", () => {
    const rows = [row()];
    expect(sourceRows({ kind: "ready", rows })).toEqual(rows);
    expect(sourceRows({ kind: "stale", rows })).toEqual(rows);
    for (const kind of ["loading", "missing", "unaddressable", "failed"] as const) {
      expect(sourceRows({ kind } as TermSource)).toEqual([]);
    }
  });

  test("the stale transcript banner promises no recovery", () => {
    expect(TERM_STALE_COPY).toBe("Transcript disconnected — showing the last received log.");
  });
});

// ── segmentation ──
describe("transcript segmentation", () => {
  const rows: TermRow[] = [
    row({ text: "old", id: "a" }),
    row({ kind: "boundary", text: "wake 1", id: "b1" }),
    row({ text: "mid", id: "b" }),
    row({ kind: "boundary", text: "wake 2", id: "b2" }),
    row({ text: "new", id: "c" }),
  ];

  test("lastBoundaryIndex finds the LAST boundary", () => {
    expect(lastBoundaryIndex(rows)).toBe(3);
    expect(lastBoundaryIndex([row()])).toBe(-1);
    expect(lastBoundaryIndex([])).toBe(-1);
  });

  test("currentWakeRows keeps the boundary row as the wake header", () => {
    expect(currentWakeRows(rows).map((r) => r.id)).toEqual(["b2", "c"]);
  });

  test("with NO boundary the whole transcript is one wake — never a blanked log", () => {
    const flat = [row({ id: "a" }), row({ id: "b" })];
    expect(currentWakeRows(flat)).toEqual(flat);
    expect(currentWakeRows([])).toEqual([]);
  });

  test("noise filtering is inverted relative to its label, and only drops noise rows", () => {
    expect(noiseShow(true)).toBe(false); // filter ON ⇒ noise HIDDEN
    expect(noiseShow(false)).toBe(true);
    const mixed = [row({ id: "a" }), row({ kind: "system", text: "n", noise: true, id: "n" })];
    expect(visibleRows(mixed, true).map((r) => r.id)).toEqual(["a", "n"]);
    expect(visibleRows(mixed, false).map((r) => r.id)).toEqual(["a"]);
  });

  test("expandability, its label, and single-row keys", () => {
    expect(isExpandable(row())).toBe(false);
    expect(isExpandable(row({ detail: "" }))).toBe(false);
    expect(isExpandable(row({ detail: "bun test" }))).toBe(true);
    expect(expandLabel(false)).toBe("(expand)");
    expect(expandLabel(true)).toBe("(collapse)");
    expect(rowKey(row({ id: "x" }), 3)).toBe("x");
    expect(rowKey(row(), 3)).toBe("3");
  });

  test("rowKeys is unique BY CONSTRUCTION — a caller repeating an id cannot collide", () => {
    // repeated ids would otherwise expand two rows together and hand the renderer duplicate keys
    const dup = [row({ id: "a" }), row({ id: "a" }), row({ id: "a" }), row({ id: "b" })];
    const keys = rowKeys(dup);
    expect(new Set(keys).size).toBe(dup.length);
    expect(keys[0]).toBe("a"); // the first occurrence keeps the caller's id, so state is stable
    // even a literal id that looks like a disambiguator this function hands out stays unique
    const adversarial = [row({ id: "a" }), row({ id: "a" }), row({ id: "a#1" })];
    expect(new Set(rowKeys(adversarial)).size).toBe(3);
    // id-less rows fall back to their index
    expect(rowKeys([row(), row()])).toEqual(["0", "1"]);
    expect(rowKeys([])).toEqual([]);
  });

  test("scopedRowKeys makes cross-scope expand-state collisions impossible", () => {
    // the naive `${scope}:${key}` prefix fails exactly here: a transcript row whose id IS another
    // scope's prefix would share expand state with that scope's row
    const transcript = scopedRowKeys([ROW_SCOPE.transcript], [row({ id: "l|a" }), row({ id: "a" })]);
    const local = scopedRowKeys([ROW_SCOPE.local], [row({ id: "a" }), row({ id: "|a" })]);
    const hist = scopedRowKeys([ROW_SCOPE.history, "seg1"], [row({ id: "a" })]);
    const all = [...transcript, ...local, ...hist];
    expect(new Set(all).size).toBe(all.length);
    // the escape character itself cannot be used to forge another scope's key either
    const evil = scopedRowKeys([ROW_SCOPE.transcript], [row({ id: "%7Ca" }), row({ id: "%" })]);
    expect(new Set([...evil, ...local, ...transcript]).size).toBe(evil.length + local.length + transcript.length);
  });

  test("two history segments never share expand state, even with identical row ids", () => {
    const rows = [row({ id: "r1" })];
    const a = scopedRowKeys([ROW_SCOPE.history, "segA"], rows);
    const b = scopedRowKeys([ROW_SCOPE.history, "segB"], rows);
    expect(a).not.toEqual(b);
  });

  test("segment identity rides the segment id, so reordering does not move expand state", () => {
    const segA = { id: "aaa", rows: [] };
    const segB = { id: "bbb", rows: [] };
    expect(segmentKeys([segA, segB])).toEqual(["aaa", "bbb"]);
    // reordered: each segment keeps ITS key, so a segment carries its expand state with it
    expect(segmentKeys([segB, segA])).toEqual(["bbb", "aaa"]);
    // an id-less or repeated segment still gets a unique key
    expect(new Set(segmentKeys([{ id: "", rows: [] }, { id: "x", rows: [] }, { id: "x", rows: [] }])).size).toBe(3);
  });

  test("uniqueKeys preserves the first occurrence and disambiguates the rest", () => {
    expect(uniqueKeys(["a", "b", "a", "a"])).toEqual(["a", "b", "a#1", "a#2"]);
    expect(uniqueKeys(["a", "a#1", "a"])).toEqual(["a", "a#1", "a#2"]); // no collision with the scheme
    expect(uniqueKeys([])).toEqual([]);
  });

  test("a foreign segment is captioned by its own immutable id", () => {
    expect(historySegmentCaption("7f3a11c9")).toBe("session 7f3a11c9");
    expect(historySegmentCaption("")).toBe("session —");
  });

  test("the history toggle copy is NEUTRAL — it never orders the segments in time", () => {
    expect(historyToggleLabel(false, 2)).toBe("↑ show other sessions in this transcript (2)");
    expect(historyToggleLabel(true, 2)).toBe("↓ hide other sessions");
    // "earlier"/"older"/"newer" would be untruthful: file order is append order, not wall time
    expect(historyToggleLabel(false, 2)).not.toMatch(/earlier|older|newer|previous/i);
  });
});

// ── block rows (structured report blocks) ──
describe("block rows — precedence and the copy affordance", () => {
  test("isBlockRow normalizes truthiness — a JS caller cannot split the two bindings", () => {
    expect(isBlockRow(row({ block: true }))).toBe(true);
    expect(isBlockRow(row({ block: false }))).toBe(false);
    expect(isBlockRow(row())).toBe(false);
    // truthy non-booleans are NOT block rows — the contract is a boolean
    expect(isBlockRow(row({ block: 1 as unknown as boolean }))).toBe(false);
    expect(isBlockRow(row({ block: "yes" as unknown as boolean }))).toBe(false);
  });

  test("`block` takes precedence over `detail` — a block row is NEVER expandable", () => {
    // hand-aligned report text must stay verbatim; an expand affordance would hide it behind a
    // collapsed head and re-wrap it in the detail pane
    expect(isExpandable(row({ block: true, detail: "a body that would otherwise expand" }))).toBe(false);
    expect(isExpandable(row({ block: true }))).toBe(false);
    // the same detail WITHOUT block still expands — precedence, not a ban on detail
    expect(isExpandable(row({ detail: "a body that would otherwise expand" }))).toBe(true);
  });

  test("the block classes are structural and distinct", () => {
    expect(TERM_CLASSES.block).toBe("my-term__block");
    expect(TERM_CLASSES.blockPre).toBe("my-term__blockpre");
    expect(TERM_CLASSES.copy).toBe("my-term__copy");
  });

  test("copy labels are verbatim, state-distinct, and the revert window is ~1.5 s", () => {
    expect(TERM_COPY_LABEL).toBe("copy");
    expect(TERM_COPIED_LABEL).toBe("copied ✓");
    expect(TERM_COPY_ARIA).toBe("Copy to clipboard");
    expect(TERM_COPIED_ARIA).toBe("Copied to clipboard");
    expect(copyLabel(false)).toBe(TERM_COPY_LABEL);
    expect(copyLabel(true)).toBe(TERM_COPIED_LABEL);
    expect(copyLabel(true)).not.toBe(copyLabel(false));
    expect(TERM_COPIED_REVERT_MS).toBe(1500);
  });

  test("the accessible name is state-aware, in lockstep with the visible label", () => {
    // a screen reader must hear the same state a sighted reader sees — never a control whose
    // accessible name still offers what it just did
    expect(copyAria(false)).toBe(TERM_COPY_ARIA);
    expect(copyAria(true)).toBe(TERM_COPIED_ARIA);
    expect(copyAria(true)).not.toBe(copyAria(false));
  });
});

// ── rich spans (the constrained structured body) ──
describe("rich spans — model, validation, and the precedence rule", () => {
  const spans: readonly TermSpan[] = [
    { t: "text", s: "the " },
    { t: "bold", s: "frozen surface" },
    { t: "text", s: " stays read-only — verify with " },
    { t: "code", s: "bun test" },
  ];
  /** A well-formed rich row: `text` carries the SAME content as plain text (the model's contract). */
  const richRow = (over: Partial<TermRow> = {}): TermRow => row({ spans, text: spansText(spans), ...over });

  test("the model is exactly three kinds — text, bold, code — and nothing else", () => {
    expect(TERM_SPAN_KINDS).toEqual(["text", "bold", "code"]);
    for (const t of TERM_SPAN_KINDS) expect(isTermSpan({ t, s: "x" })).toBe(true);
    // no HTML-shaped arm may ever join the model quietly
    expect(isTermSpan({ t: "html", s: "<b>x</b>" })).toBe(false);
    expect(isTermSpan({ t: "link", s: "x" })).toBe(false);
  });

  test("isTermSpan rejects every malformed shape", () => {
    expect(isTermSpan(null)).toBe(false);
    expect(isTermSpan(undefined)).toBe(false);
    expect(isTermSpan("bold")).toBe(false);
    expect(isTermSpan({ t: "bold" })).toBe(false); // no s
    expect(isTermSpan({ t: "bold", s: 7 })).toBe(false); // non-string s
    expect(isTermSpan({ s: "x" })).toBe(false); // no t
  });

  test("spansText concatenates VERBATIM — no separators, no trimming", () => {
    expect(spansText(spans)).toBe("the frozen surface stays read-only — verify with bun test");
    expect(spansText([])).toBe("");
    expect(spansText([{ t: "code", s: "  spaced  " }])).toBe("  spaced  ");
    // defensive over malformed input, like the other pure helpers
    expect(spansText(undefined as unknown as TermSpan[])).toBe("");
  });

  test("rowSpans returns a valid run VERBATIM — the same array, not a copy", () => {
    expect(rowSpans(richRow())).toBe(spans);
  });

  test("absent, empty or non-array spans fall back to plain text", () => {
    expect(rowSpans(row())).toBeNull();
    expect(rowSpans(row({ spans: [] }))).toBeNull();
    expect(rowSpans(row({ spans: "**bold**" as unknown as TermSpan[] }))).toBeNull();
  });

  test("ONE malformed member disqualifies the WHOLE run — text is the lossless fallback", () => {
    // dropping or coercing the bad span would silently render something the caller never wrote;
    // `text` is required to carry the same content, so falling back loses nothing
    expect(rowSpans(richRow({ spans: [...spans, { t: "html", s: "<b>x</b>" } as unknown as TermSpan] }))).toBeNull();
    expect(rowSpans(richRow({ spans: [...spans, { t: "bold", s: 7 } as unknown as TermSpan] }))).toBeNull();
    expect(rowSpans(richRow({ spans: [null as unknown as TermSpan] }))).toBeNull();
  });

  test("a span run whose content diverges from `text` is disqualified WHOLESALE (gate finding)", () => {
    // copy, the fallback and termContentRevision all read `text` — a divergent run would render
    // words those paths never see. Equality is ENFORCED in rowSpans, not just documented.
    expect(rowSpans(richRow({ text: "safe", spans: [{ t: "bold", s: "different" }] }))).toBeNull();
    // equality is exact — same letters, different whitespace still disqualifies
    expect(rowSpans(richRow({ text: spans.map((s) => s.s).join("") + " " }))).toBeNull();
  });

  test("precedence: `block` > `spans` — a block row NEVER renders spans", () => {
    expect(rowSpans(richRow({ block: true }))).toBeNull();
    // the same spans WITHOUT block do render — precedence, not a ban
    expect(rowSpans(richRow({ block: false }))).toBe(spans);
  });

  test("spans work on EVERY row kind", () => {
    for (const kind of TERM_ROW_KINDS) expect(rowSpans(richRow({ kind }))).toBe(spans);
  });

  test("spans leave expandability alone — detail still expands, spans ride the head", () => {
    expect(isExpandable(richRow({ detail: "a body" }))).toBe(true);
    expect(isExpandable(richRow())).toBe(false);
    // and block precedence over detail is unchanged by spans
    expect(isExpandable(richRow({ block: true, detail: "a body" }))).toBe(false);
  });

  test("the codespan class is structural and distinct", () => {
    expect(TERM_CLASSES.codeSpan).toBe("my-term__codespan");
  });
});

describe("termClipboardWriter — feature guard + honest outcome", () => {
  test("anything less than a real writeText is treated as ABSENT (the control renders nothing)", () => {
    expect(termClipboardWriter(undefined)).toBeNull();
    expect(termClipboardWriter(null)).toBeNull();
    expect(termClipboardWriter({})).toBeNull();
    expect(termClipboardWriter({ navigator: {} })).toBeNull();
    expect(termClipboardWriter({ navigator: { clipboard: {} } })).toBeNull();
    // a non-function writeText (a hostile or broken shim) is absent, not a crash waiting to happen
    expect(termClipboardWriter({ navigator: { clipboard: { writeText: "not a function" } } })).toBeNull();
  });

  test("a present clipboard yields a writer that hands over the text VERBATIM and resolves true", async () => {
    const seen: string[] = [];
    const write = termClipboardWriter({
      navigator: { clipboard: { writeText: (t: string) => void seen.push(t) } },
    });
    expect(write).not.toBeNull();
    const text = "Handoff(s):        none found — degraded mode";
    await expect(write!(text)).resolves.toBe(true);
    expect(seen).toEqual([text]); // verbatim — no prompt glyphs, no trimming, no re-wrapping
  });

  test("a REJECTED or THROWING write resolves false — never a 'copied' for an empty clipboard", async () => {
    const rejecting = termClipboardWriter({
      navigator: { clipboard: { writeText: () => Promise.reject(new Error("not focused")) } },
    });
    await expect(rejecting!("x")).resolves.toBe(false);
    const throwing = termClipboardWriter({
      navigator: {
        clipboard: {
          writeText: () => {
            throw new Error("denied");
          },
        },
      },
    });
    await expect(throwing!("x")).resolves.toBe(false);
  });
});

// ── follow-tail ──
describe("nearBottom — the follow-tail window", () => {
  test("exactly at the bottom is near", () => {
    expect(nearBottom(500, 1000, 500, 48)).toBe(true); // gap 0
    expect(nearBottom(500, 1000, 500, 0)).toBe(true); // even with no window at all
  });

  test("within the threshold is near; the boundary is inclusive; beyond is not", () => {
    expect(nearBottom(453, 1000, 500, 48)).toBe(true); // gap 47
    expect(nearBottom(452, 1000, 500, 48)).toBe(true); // gap 48 — the boundary itself
    expect(nearBottom(451, 1000, 500, 48)).toBe(false); // gap 49 — scrolled up, never force-scroll
    expect(nearBottom(0, 1000, 500, 48)).toBe(false); // top of a long log
  });

  test("the exported default threshold is 48px and is what the 3-arg form uses", () => {
    expect(FOLLOW_TAIL_THRESHOLD_PX).toBe(48);
    expect(nearBottom(452, 1000, 500)).toBe(true); // gap 48 under the default
    expect(nearBottom(451, 1000, 500)).toBe(false); // gap 49 under the default
  });

  test("degenerate geometry counts as near — a pane that cannot scroll is at its own bottom", () => {
    expect(nearBottom(0, 100, 500, 48)).toBe(true); // content shorter than the viewport
    expect(nearBottom(0, 0, 0, 48)).toBe(true); // zero heights (unlaid-out pane)
    expect(nearBottom(0, 500, 500, 0)).toBe(true); // content exactly fills the viewport
  });

  test("a non-finite measurement counts as near — following is the safe default", () => {
    expect(nearBottom(Number.NaN, 1000, 500, 48)).toBe(true);
    expect(nearBottom(0, Number.NaN, 500, 48)).toBe(true);
    expect(nearBottom(0, 1000, Number.NaN, 48)).toBe(true);
  });
});

describe("termContentRevision — ONE key over everything the body renders", () => {
  // The bindings' follow-tail pin effect depends on this single value: if a content change the
  // pane should follow does not change the key, the pane silently stops following it.
  const base = () => ({
    view: { kind: "log", stale: false } as TermView,
    rows: [row({ text: "one" }), row({ text: "two" })] as readonly TermRow[],
    localRows: [] as readonly TermRow[],
    history: [] as readonly TranscriptSegment[],
    showHistory: false,
    wakeUnavailable: false,
    caret: false,
    currentWakeOnly: false,
    noiseFilter: false,
    expandedCount: 0,
  });

  test("identical inputs give an identical key — an unchanged poll re-pins nothing", () => {
    expect(termContentRevision(base())).toBe(termContentRevision(base()));
  });

  test("a row appended changes the key", () => {
    const grown = { ...base(), rows: [...base().rows, row({ text: "three" })] };
    expect(termContentRevision(grown)).not.toBe(termContentRevision(base()));
  });

  test("a tail row growing IN PLACE changes the key — a streaming update adds no row", () => {
    const streamed = { ...base(), rows: [row({ text: "one" }), row({ text: "two grew mid-stream" })] };
    expect(termContentRevision(streamed)).not.toBe(termContentRevision(base()));
  });

  test("an expanded body growing in place changes the key — detail counts, not just text", () => {
    const detailGrew = { ...base(), rows: [row({ text: "one" }), row({ text: "two", detail: "a body" })] };
    expect(termContentRevision(detailGrew)).not.toBe(termContentRevision(base()));
  });

  test("local rows are covered", () => {
    const withLocal = { ...base(), localRows: [row({ kind: "local", text: "— turn interrupted (^C) —" })] };
    expect(termContentRevision(withLocal)).not.toBe(termContentRevision(base()));
  });

  test("history segments and their disclosure are covered", () => {
    const seg: TranscriptSegment = { id: "7f3a11c9", rows: [row({ text: "a foreign line" })] };
    const withHistory = { ...base(), history: [seg] };
    expect(termContentRevision(withHistory)).not.toBe(termContentRevision(base()));
    const disclosed = { ...withHistory, showHistory: true };
    expect(termContentRevision(disclosed)).not.toBe(termContentRevision(withHistory));
  });

  test("both banners and the caret are covered", () => {
    expect(termContentRevision({ ...base(), wakeUnavailable: true })).not.toBe(termContentRevision(base()));
    const stale = { ...base(), view: { kind: "log", stale: true } as TermView };
    expect(termContentRevision(stale)).not.toBe(termContentRevision(base()));
    expect(termContentRevision({ ...base(), caret: true })).not.toBe(termContentRevision(base()));
  });

  test("the current-wake filter is covered by the FLAG itself, even when the visible rows coincide", () => {
    // the regression this guards: toggling current-wake was missing from the pin effect's inputs
    expect(termContentRevision({ ...base(), currentWakeOnly: true })).not.toBe(termContentRevision(base()));
  });

  test("the noise filter is covered by the FLAG itself, even when the visible rows coincide", () => {
    expect(termContentRevision({ ...base(), noiseFilter: true })).not.toBe(termContentRevision(base()));
  });

  test("the expand state is covered — expanding a detail row moves the bottom edge", () => {
    // the regression this guards: the expand state was missing from the pin effect's inputs
    expect(termContentRevision({ ...base(), expandedCount: 1 })).not.toBe(termContentRevision(base()));
  });

  test("a log view and a state view never share a key", () => {
    const state = { ...base(), rows: [] as readonly TermRow[], view: { kind: "state", copy: "loading…" } as TermView };
    expect(termContentRevision(state)).not.toBe(termContentRevision({ ...base(), rows: [] }));
  });

  // ── the positional per-row encoding ──
  //
  // The key is an ORDERED tuple of per-row MEASURES, not a total. The tests below pin the three
  // shapes a folded total gets wrong (cross-row cancellation, weighted cancellation, a field the
  // fold never read at all), plus the residual the encoding deliberately does NOT catch.

  // `row()` above defaults to `kind: "assistant"`; this one exists so the cases below read as
  // pure measure-differences rather than inheriting that file-wide fixture's text.
  const mkRow = (o: Partial<TermRow>): TermRow => ({ kind: "system", text: "", ...o });

  /** `rev` wraps the REAL 10-field input; only `rows` varies between the cases below. */
  const rev = (rows: TermRow[]): string =>
    termContentRevision({
      view: { kind: "log", stale: false } as TermView,
      rows,
      localRows: [],
      history: [],
      showHistory: false,
      wakeUnavailable: false,
      caret: false,
      currentWakeOnly: false,
      noiseFilter: false,
      expandedCount: 0,
    });

  test("the outer fields still change the revision — nothing was dropped", () => {
    const rows = [mkRow({ text: "x" })];
    const revWith = (o: Partial<Parameters<typeof termContentRevision>[0]>) =>
      termContentRevision({
        view: { kind: "log", stale: false } as TermView, rows, localRows: [], history: [],
        showHistory: false, wakeUnavailable: false, caret: false, currentWakeOnly: false,
        noiseFilter: false, expandedCount: 0, ...o,
      });
    expect(revWith({ caret: true })).not.toBe(revWith({}));
    expect(revWith({ expandedCount: 1 })).not.toBe(revWith({}));
    expect(revWith({ localRows: rows })).not.toBe(revWith({}));
    expect(revWith({ showHistory: true })).not.toBe(revWith({}));
    expect(revWith({ wakeUnavailable: true })).not.toBe(revWith({}));
    expect(revWith({ currentWakeOnly: true })).not.toBe(revWith({}));
    expect(revWith({ noiseFilter: true })).not.toBe(revWith({}));
    // history and BOTH view arms
    expect(revWith({ history: [{ id: "s1", rows: [mkRow({ text: "h" })] }] })).not.toBe(revWith({}));
    expect(revWith({ view: { kind: "state", copy: "loading…" } as TermView })).not.toBe(revWith({}));
    expect(revWith({ view: { kind: "log", stale: true } as TermView })).not.toBe(revWith({}));
  });

  test("localRows get the same positional encoding as rows", () => {
    const a = [mkRow({ text: "aaa" }), mkRow({ text: "bbbbbb" })];
    const b = [mkRow({ text: "aaaaaa" }), mkRow({ text: "bbb" })];
    const withLocal = (localRows: TermRow[]) =>
      termContentRevision({
        view: { kind: "log", stale: false } as TermView, rows: [], localRows, history: [],
        showHistory: false, wakeUnavailable: false, caret: false, currentWakeOnly: false,
        noiseFilter: false, expandedCount: 0,
      });
    expect(withLocal(a)).not.toBe(withLocal(b));
  });

  test("cross-row length deltas cannot cancel (+3/-3)", () => {
    const a = [mkRow({ text: "aaa" }), mkRow({ text: "bbbbbb" })];
    const b = [mkRow({ text: "aaaaaa" }), mkRow({ text: "bbb" })];
    expect(rev(a)).not.toBe(rev(b));
  });

  test("weighted cancellation cannot occur either (+4/-2)", () => {
    const a = [mkRow({ text: "aaaa" }), mkRow({ text: "bbbbbb" })];
    const b = [mkRow({ text: "aaaaaaaa" }), mkRow({ text: "bbbb" })];
    expect(rev(a)).not.toBe(rev(b));
  });

  test("a label-only change is visible", () => {
    expect(rev([mkRow({ label: "storing…", text: "x" })]))
      .not.toBe(rev([mkRow({ label: "stored", text: "x" })]));
  });

  test("an ABSENT field is distinguishable from an empty one", () => {
    expect(rev([mkRow({ text: "x" })])).not.toBe(rev([mkRow({ label: "", text: "x" })]));
    expect(rev([mkRow({ text: "x" })])).not.toBe(rev([mkRow({ text: "x", detail: "" })]));
  });

  /** Everything `rowSpans` refuses to render, so the encoding can be checked against it. */
  const NON_RENDERING_SPANS: unknown[] = [
    [],                          // empty
    "not-an-array",              // a non-array that HAS a .length
    5,                           // a non-array that is not even iterable
    { a: 1 },                    // ditto, object-shaped
    [null],                      // a null member
    [{ t: "nope", s: "x" }],     // an unknown span kind
    [{ t: "bold" }],             // a member with no text
    [{ t: "bold", s: "x" }, 7],  // ONE malformed member disqualifies the whole run
  ];

  test("a span run is encoded only when it is the run that RENDERS", () => {
    // `rowSpans` falls back to `text` for an empty, malformed or block-row run, so each of those
    // encodes as absent: the key measures what a reader actually sees.
    const none = rev([mkRow({ text: "x" })]);
    for (const spans of NON_RENDERING_SPANS) {
      expect(rev([mkRow({ text: "x", spans: spans as never })])).toBe(none);
    }
    // a block row ignores spans entirely (`block` beats `spans`), so a valid run is absent there too
    expect(rev([mkRow({ text: "x", block: true, spans: [{ t: "bold", s: "x" }] })]))
      .toBe(rev([mkRow({ text: "x", block: true })]));
    // and a run that DOES render is encoded, so it differs
    expect(rev([mkRow({ text: "x", spans: [{ t: "bold", s: "x" }] })])).not.toBe(none);
  });

  test("a malformed spans value can never throw — the revision is computed during render", () => {
    // Regression: iterating a RAW `spans` threw four different ways — `undefined is not an object`
    // on a string's characters, `not iterable` on a number or a plain object, and `null is not an
    // object` on a null member. Any of them takes down a binding's render, on input `rowSpans` is
    // explicitly written to survive.
    for (const spans of NON_RENDERING_SPANS) {
      expect(() => rev([mkRow({ text: "x", spans: spans as never })])).not.toThrow();
    }
  });

  test("the row KIND is part of the encoding", () => {
    expect(rev([mkRow({ kind: "memory", text: "x" })])).not.toBe(rev([mkRow({ kind: "system", text: "x" })]));
  });

  test("a block flag flip is visible", () => {
    expect(rev([mkRow({ text: "x" })])).not.toBe(rev([mkRow({ text: "x", block: true })]));
  });

  test("a span restructuring at identical total length is visible", () => {
    const bodyFirst = mkRow({ text: "abcd", spans: [{ t: "bold", s: "ab" }, { t: "text", s: "cd" }] });
    const bodySecond = mkRow({ text: "abcd", spans: [{ t: "text", s: "ab" }, { t: "bold", s: "cd" }] });
    expect(rev([bodyFirst])).not.toBe(rev([bodySecond]));
  });

  test("two rows resolving in the SAME poll with opposite deltas both stay visible", () => {
    // the concrete shape a folded total misses: an in-place resolution of two rows whose length
    // changes are +3 and -3 leaves any sum identical, so follow-tail never re-runs.
    const before = [mkRow({ label: "recalling", text: "" }), mkRow({ label: "storing…", text: "" })];
    const after = [mkRow({ label: "recalled 0", text: "" }), mkRow({ label: "stored", text: "" })];
    expect(rev(before)).not.toBe(rev(after));
  });

  test("row order alone changes the revision — the encoding is positional", () => {
    const a = [mkRow({ text: "aa" }), mkRow({ text: "b" })];
    expect(rev(a)).not.toBe(rev([a[1]!, a[0]!]));
  });

  test("two adjacent row runs cannot be confused for one — the leading count disambiguates", () => {
    // `rows` and `localRows` are encoded by the same helper and then joined; without the leading
    // length a row moving from one list to the other could produce an identical concatenation.
    const mk = (rows: TermRow[], localRows: TermRow[]) =>
      termContentRevision({
        view: { kind: "log", stale: false } as TermView, rows, localRows, history: [],
        showHistory: false, wakeUnavailable: false, caret: false, currentWakeOnly: false,
        noiseFilter: false, expandedCount: 0,
      });
    const r = mkRow({ text: "x" });
    expect(mk([r, r], [])).not.toBe(mk([r], [r]));
  });

  test("a same-length same-presence replacement is NOT detected — documented residual", () => {
    // Asserted as a MISS, not a promised catch: the key measures rows, it does not read them.
    expect(rev([mkRow({ label: "abc", text: "x" })])).toBe(rev([mkRow({ label: "xyz", text: "x" })]));
  });
});

// ── title bar ──
describe("title bar", () => {
  test("title text composes name · tail · noise state, with a neutral fallback", () => {
      // The label states whether NOISE is showing, not whether the FILTER is engaged
      // (maintainer ruling 2026-08-14). Filter ENGAGED ⇒ noise hidden ⇒ reads `noise off`.
      expect(termTitleText("jacob.jsonl", true)).toBe("jacob.jsonl · tail · noise off");
      expect(termTitleText("jacob.jsonl", false)).toBe("jacob.jsonl · tail · noise on");
      expect(termTitleText(undefined, true)).toBe("transcript · tail · noise off");
      expect(termTitleText("  ", true)).toBe("transcript · tail · noise off");
      // The filter ships ENGAGED, so an untouched pane reads `noise off` WHILE it suppresses.
      // Label and renderer must agree on that default — that agreement is the ruling.
      expect(noiseShow(true)).toBe(false);
  });

  test("the turn caption renders ONLY from supplied truth — undefined guesses nothing", () => {
    expect(turnCaption(true)).toBe(TURN_IN_FLIGHT_COPY);
    expect(turnCaption(false)).toBe(TURN_IDLE_COPY);
    expect(turnCaption(undefined)).toBeNull();
  });

  test("stop prominence is a visual weight, not a second state axis", () => {
    expect(stopButtonClass(false)).toBe("my-term__stop");
    expect(stopButtonClass(true)).toBe("my-term__stop is-prominent");
  });

  test("Ctrl-C stops only when focused, unselected and not a key-repeat", () => {
    expect(shouldStopOnKey({ key: "c", ctrlKey: true }, "", true)).toBe(true);
    expect(shouldStopOnKey({ key: "c", ctrlKey: true }, "", false)).toBe(false); // not focused
    expect(shouldStopOnKey({ key: "c", ctrlKey: true }, "copy me", true)).toBe(false); // selection
    expect(shouldStopOnKey({ key: "c", ctrlKey: true, repeat: true }, "", true)).toBe(false); // held
    expect(shouldStopOnKey({ key: "c", ctrlKey: false }, "", true)).toBe(false);
    expect(shouldStopOnKey({ key: "x", ctrlKey: true }, "", true)).toBe(false);
    expect(shouldStopOnKey(null, "", true)).toBe(false);
  });
});

// ── send bar composition ──
describe("send bar composition", () => {
  test("delivery classes, the shared default, and their labels", () => {
    expect(DELIVERY_CLASSES).toEqual(["asap", "on-done"]);
    expect(DELIVERY_CLASSES).toContain(DEFAULT_DELIVERY_CLASS);
    expect(deliveryClassLabel("asap")).toBe("ASAP");
    expect(deliveryClassLabel("on-done")).toBe("ON-DONE");
  });

  test("a disabled bar surfaces the caller's honest reason, never the enabled prompt", () => {
    expect(sendPlaceholder(true, "Jacob is stopped — restart to message")).toBe(
      "Jacob is stopped — restart to message",
    );
    expect(sendPlaceholder(true)).toBe(SEND_DISABLED_FALLBACK);
    expect(sendPlaceholder(true, undefined, "Jacob")).toBe(SEND_DISABLED_FALLBACK);
  });

  test("an enabled bar carries the target name when given", () => {
    expect(sendPlaceholder(false, undefined, "Jacob")).toBe("Message Jacob… (⏎ send · ⇧⏎ newline)");
    expect(sendPlaceholder(false)).toBe(SEND_PLACEHOLDER);
    expect(sendPlaceholder(false, undefined, "   ")).toBe(SEND_PLACEHOLDER);
  });

  test("send requires non-blank text, enabled and not busy", () => {
    expect(canSend("hi", false, false)).toBe(true);
    expect(canSend("", false, false)).toBe(false);
    expect(canSend("   \n ", false, false)).toBe(false);
    expect(canSend("hi", true, false)).toBe(false);
    expect(canSend("hi", false, true)).toBe(false);
  });

  test("the send gate is single-flight — a second attempt in the same tick is refused", () => {
    // `canSend`'s `busy` covers a caller that tracks the request; the gate covers the window a
    // caller that flips `busy` a tick late (or never) would leave open, in which two clicks — or a
    // click racing an Enter — both call onSend and deliver the same message twice
    const gate = makeSendGate();
    expect(gate.inFlight()).toBe(false);
    expect(gate.tryAcquire()).toBe(true);
    expect(gate.inFlight()).toBe(true);
    expect(gate.tryAcquire()).toBe(false); // the duplicate delivery, refused
    expect(gate.tryAcquire()).toBe(false);
    gate.release();
    expect(gate.inFlight()).toBe(false);
    expect(gate.tryAcquire()).toBe(true); // reusable for the NEXT send
  });

  test("releasing an unheld gate is safe, and gates are independent", () => {
    const gate = makeSendGate();
    gate.release();
    expect(gate.inFlight()).toBe(false);
    const other = makeSendGate();
    expect(gate.tryAcquire()).toBe(true);
    expect(other.tryAcquire()).toBe(true); // one bar's in-flight send never blocks another's
  });

  test("a REJECTED onSend is a failed send, not an unhandled rejection", async () => {
    // letting a rejection escape the async event handler surfaces an application error for what is
    // really just a send that did not land
    const boom = new Error("network down");
    const seen: unknown[] = [];
    await expect(
      resolveSend(() => {
        throw boom;
      }, (e) => seen.push(e)),
    ).resolves.toBe(false);
    expect(seen).toEqual([boom]);

    const seen2: unknown[] = [];
    await expect(resolveSend(() => Promise.reject(boom), (e) => seen2.push(e))).resolves.toBe(false);
    expect(seen2).toEqual([boom]);

    // and with NO error callback it still resolves false rather than rejecting
    await expect(resolveSend(() => Promise.reject(boom))).resolves.toBe(false);
  });

  test("only a resolved `true` counts as sent — a rejection can never look like success", async () => {
    await expect(resolveSend(() => true)).resolves.toBe(true);
    await expect(resolveSend(() => Promise.resolve(true))).resolves.toBe(true);
    await expect(resolveSend(() => false)).resolves.toBe(false);
    // a truthy non-boolean is NOT a success — the contract is a boolean
    await expect(resolveSend(() => "ok" as unknown as boolean)).resolves.toBe(false);
  });

  test("the draft clears only on success AND only if it is still the submitted text", () => {
    expect(clearDraftOnSend(true, "a", "a")).toBe(true);
    expect(clearDraftOnSend(true, "a", "a newer draft")).toBe(false); // typed while in flight
    expect(clearDraftOnSend(false, "a", "a")).toBe(false); // failure keeps the text
  });

  test("bar and segment class derivation", () => {
    expect(sendBarClass(false)).toBe("my-sendbar");
    expect(sendBarClass(true)).toBe("my-sendbar is-disabled");
    expect(deliveryClassButtonClass(false)).toBe("my-sendbar__cls");
    expect(deliveryClassButtonClass(true)).toBe("my-sendbar__cls is-on");
  });
});
