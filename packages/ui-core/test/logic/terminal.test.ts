// test/logic/terminal.test.ts — the terminal set's pure core (ds/components-terminal v2):
// terminal · queue-row · send-bar.
//
// Beyond ordinary correctness, this file is the regression suite for the SIX honesty invariants the
// extraction had to carry out of the product intact. Each is stated where it is asserted; they are
// design, not product logic, which is why they live in this package and not in a consumer.

import { describe, expect, test } from "bun:test";
import {
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  QUEUE_CANCEL_ASK,
  QUEUE_EMPTY_COPY,
  QUEUE_LOADING_COPY,
  QUEUE_STALE_COPY,
  QUEUE_UNAVAILABLE_COPY,
  SEND_DISABLED_FALLBACK,
  SEND_PLACEHOLDER,
  TERM_CLASS,
  TERM_FAILED_COPY,
  TERM_LOADING_COPY,
  TERM_MISSING_COPY,
  TERM_NO_EVENTS_COPY,
  TERM_ROW_KINDS,
  TERM_STALE_COPY,
  TERM_UNADDRESSABLE_COPY,
  TERM_WAKE_UNAVAILABLE_COPY,
  TURN_IDLE_COPY,
  TURN_IN_FLIGHT_COPY,
  canCancelRow,
  canSend,
  cancelReducer,
  clearDraftOnSend,
  currentWakeRows,
  deliveryClassButtonClass,
  expandLabel,
  deliveryClassLabel,
  historySegmentCaption,
  historyToggleLabel,
  isExpandable,
  keyAction,
  lastBoundaryIndex,
  noiseShow,
  queueBadgeClass,
  queueBadgeLabel,
  queueRowClass,
  queueStatusLabel,
  queueView,
  rowKey,
  rowKeys,
  sendBarClass,
  sendPlaceholder,
  shouldDisarmCancel,
  shouldStopOnKey,
  showDeliveryHint,
  sourceRows,
  stopButtonClass,
  termRowClass,
  termTitleText,
  transcriptView,
  turnCaption,
  unavailableText,
  visibleRows,
  type QueueItem,
  type QueueItemStatus,
  type QueueSource,
  type QueueUnavailableReason,
  type TermRow,
  type TermSource,
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
    expect(view).toEqual({ kind: "list", items: [], staleCopy: QUEUE_STALE_COPY });
    const fresh = queueView({ kind: "ok", items: [item()] });
    expect(fresh).toEqual({ kind: "list", items: [item()], staleCopy: null });
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
    // a stale source still carrying the queued row keeps the arm
    expect(shouldDisarmCancel("e1", true, { kind: "stale", items: [item({ id: "e1" })] })).toBe(false);
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

// ── title bar ──
describe("title bar", () => {
  test("title text composes name · tail · noise state, with a neutral fallback", () => {
    expect(termTitleText("jacob.jsonl", false)).toBe("jacob.jsonl · tail · noise off");
    expect(termTitleText("jacob.jsonl", true)).toBe("jacob.jsonl · tail · noise on");
    expect(termTitleText(undefined, false)).toBe("transcript · tail · noise off");
    expect(termTitleText("  ", false)).toBe("transcript · tail · noise off");
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
  test("delivery classes and their labels", () => {
    expect(DELIVERY_CLASSES).toEqual(["asap", "on-done"]);
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
