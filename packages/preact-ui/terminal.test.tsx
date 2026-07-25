/** @jsxImportSource preact */
// packages/preact-ui/terminal.test.tsx — the terminal set's Preact binding (ds/components-terminal
// v2): Terminal · QueueRow/QueuePanel · SendBar.
//
// These are render assertions only: the state machines and the honesty rules themselves are proven
// DOM-free in ui-core's test/logic/terminal.test.ts. What is proven here is that the binding
// actually renders what ui-core resolved — that no copy was retyped locally, no branch was
// collapsed, and no class was hard-coded — plus the same self-containment scan the other atoms get
// (every emitted class resolves in ui-core's styles.css; no inline style attributes).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  DELIVERY_HINT,
  QUEUE_EMPTY_COPY,
  QUEUE_LOADING_COPY,
  QUEUE_STALE_COPY,
  QUEUE_UNAVAILABLE_COPY,
  TERM_CLASS,
  TERM_FAILED_COPY,
  TERM_LOADING_COPY,
  TERM_MISSING_COPY,
  TERM_NO_EVENTS_COPY,
  TERM_STALE_COPY,
  TERM_UNADDRESSABLE_COPY,
  TERM_WAKE_UNAVAILABLE_COPY,
  TURN_IDLE_COPY,
  TURN_IN_FLIGHT_COPY,
  queueBadgeClass,
  queueRowClass,
  sendPlaceholder,
  termRowClass,
  termTitleText,
  type QueueItem,
  type QueueItemStatus,
  type QueueSource,
  type TermRow,
} from "@mythicalos/ui-core/logic";
import { QueuePanel, QueueRow, SendBar, Terminal } from "./src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");
const noop = () => {};
const sent = async () => true;

function item(over: Partial<QueueItem> = {}): QueueItem {
  return { id: "e1", cls: "asap", body: "re-run the fold matrix", status: "queued", ...over };
}
const rows: TermRow[] = [
  { kind: "boundary", text: "session jacob · started 2026-07-24 09:00:00Z", id: "b" },
  { kind: "assistant", label: "▍assistant", text: "seam refactor green — 214 tests, 0 fail.", id: "a1" },
  { kind: "user", label: "← user", text: "hold the rollout until the envelope test lands", id: "u1" },
  { kind: "tool", label: "▸ tool Bash", text: "bun test src/delivery", detail: "bun test src/delivery", id: "t1" },
  { kind: "system", text: "thinking_tokens", noise: true, id: "n1" },
];

describe("Terminal — always heritage-dark (invariant 1)", () => {
  test("the root class is exactly the ui-core surface class, on every branch", () => {
    const branches = [
      <Terminal source={{ kind: "loading" }} />,
      <Terminal source={{ kind: "missing" }} />,
      <Terminal source={{ kind: "unaddressable" }} />,
      <Terminal source={{ kind: "failed" }} />,
      <Terminal source={{ kind: "ready", rows }} />,
      <Terminal source={{ kind: "stale", rows }} />,
    ];
    for (const el of branches) {
      const html = renderToString(el);
      // the ROOT element's class list is exactly the surface class — no theme modifier of any kind
      // may ride it, in either direction
      expect(html.match(/^<div class="([^"]*)"/)?.[1]).toBe(TERM_CLASS);
    }
  });
});

describe("Terminal — the six source branches (loading honesty)", () => {
  test("loading renders its own copy and NEVER `(no events)`", () => {
    const html = renderToString(<Terminal source={{ kind: "loading" }} />);
    expect(html).toContain(TERM_LOADING_COPY);
    expect(html).not.toContain(TERM_NO_EVENTS_COPY);
  });

  test("missing / unaddressable / failed render three DISTINCT states", () => {
    expect(renderToString(<Terminal source={{ kind: "missing" }} />)).toContain(TERM_MISSING_COPY);
    expect(renderToString(<Terminal source={{ kind: "unaddressable" }} />)).toContain(TERM_UNADDRESSABLE_COPY);
    expect(renderToString(<Terminal source={{ kind: "failed" }} />)).toContain(TERM_FAILED_COPY);
    // and none of them borrows another's message
    const missing = renderToString(<Terminal source={{ kind: "missing" }} />);
    expect(missing).not.toContain(TERM_FAILED_COPY);
    expect(missing).not.toContain(TERM_UNADDRESSABLE_COPY);
  });

  test("ready renders rows through ui-core's row classes; noise obeys the filter", () => {
    const shown = renderToString(<Terminal source={{ kind: "ready", rows }} noiseFilterEnabled={false} />);
    expect(shown).toContain(termRowClass("assistant"));
    expect(shown).toContain(termRowClass("user"));
    expect(shown).toContain(termRowClass("tool"));
    expect(shown).toContain("thinking_tokens"); // filter off ⇒ noise shown
    const hidden = renderToString(<Terminal source={{ kind: "ready", rows }} noiseFilterEnabled />);
    expect(hidden).not.toContain("thinking_tokens");
  });

  test("stale renders the log AND flags itself, with no retry claim", () => {
    const html = renderToString(<Terminal source={{ kind: "stale", rows }} />);
    expect(html).toContain(TERM_STALE_COPY);
    expect(html).toContain(termRowClass("assistant"));
    expect(html).not.toMatch(/reconnect|retrying/i);
  });

  test("an empty ready log says `(no events)` — a state only a completed read can reach", () => {
    expect(renderToString(<Terminal source={{ kind: "ready", rows: [] }} />)).toContain(TERM_NO_EVENTS_COPY);
  });
});

describe("Terminal — wake banner (invariant 6) and the turn caption", () => {
  test("the wake banner says exactly `wake unavailable`, never a retry", () => {
    const html = renderToString(<Terminal source={{ kind: "ready", rows }} wakeUnavailable />);
    expect(html).toContain(TERM_WAKE_UNAVAILABLE_COPY);
    expect(html).not.toMatch(/reconnect|retrying|\(\d+\/\d+\)/i);
    // and it is INDEPENDENT of the transcript branch
    expect(renderToString(<Terminal source={{ kind: "loading" }} wakeUnavailable />)).toContain(
      TERM_WAKE_UNAVAILABLE_COPY,
    );
  });

  test("the turn caption renders only from supplied truth", () => {
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} turnInFlight />)).toContain(TURN_IN_FLIGHT_COPY);
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} turnInFlight={false} />)).toContain(
      TURN_IDLE_COPY,
    );
    const unknown = renderToString(<Terminal source={{ kind: "ready", rows }} />);
    expect(unknown).not.toContain(TURN_IN_FLIGHT_COPY);
    expect(unknown).not.toContain(TURN_IDLE_COPY);
  });
});

describe("Terminal — title bar, stop control, history disclosure", () => {
  test("the title line is ui-core's composition; a read-only pane gets a caption, not a dead button", () => {
    const interactive = renderToString(
      <Terminal source={{ kind: "ready", rows }} name="jacob.jsonl" noiseFilterEnabled onToggleNoise={noop} />,
    );
    expect(interactive).toContain(termTitleText("jacob.jsonl", true));
    expect(interactive).toContain('class="my-term__noise"');
    const readOnly = renderToString(<Terminal source={{ kind: "ready", rows }} name="jacob.jsonl" />);
    expect(readOnly).toContain('class="my-term__title"');
    expect(readOnly).not.toContain('class="my-term__noise"');
  });

  test("no stop handler ⇒ no stop control at all", () => {
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} />)).not.toContain("my-term__stop");
    const withStop = renderToString(<Terminal source={{ kind: "ready", rows }} onStopTurn={noop} />);
    expect(withStop).toContain("my-term__stop");
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} onStopTurn={noop} stopProminent />)).toContain(
      "my-term__stop is-prominent",
    );
  });

  test("foreign segments stay behind the disclosure and are never blended into the log", () => {
    const history = [{ id: "7f3a11c9", rows: [{ kind: "assistant" as const, text: "a foreign line" }] }];
    const html = renderToString(<Terminal source={{ kind: "ready", rows }} history={history} />);
    expect(html).toContain("↑ show other sessions in this transcript (1)");
    expect(html).not.toContain("a foreign line"); // collapsed by default
    expect(html).not.toContain("my-term__hist-cap");
  });

  test("currentWakeOnly renders from the last boundary on", () => {
    const withOld: TermRow[] = [{ kind: "assistant", text: "before the wake" }, ...rows];
    const html = renderToString(<Terminal source={{ kind: "ready", rows: withOld }} currentWakeOnly />);
    expect(html).not.toContain("before the wake");
    expect(html).toContain("seam refactor green");
  });

  test("the caret is opt-in", () => {
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} />)).not.toContain("my-term__caret");
    expect(renderToString(<Terminal source={{ kind: "ready", rows }} caret />)).toContain("my-term__caret");
  });
});

describe("QueuePanel — source→view honesty (invariant 3)", () => {
  test("loading renders the loading state, never the empty presentation", () => {
    const html = renderToString(<QueuePanel source={{ kind: "loading" }} />);
    expect(html).toContain(QUEUE_LOADING_COPY);
    expect(html).not.toContain("my-queue__empty");
    expect(html).not.toContain(QUEUE_EMPTY_COPY);
  });

  test("ok + zero items is the only path to the capability-neutral empty copy", () => {
    const html = renderToString(<QueuePanel source={{ kind: "ok", items: [] }} />);
    expect(html).toContain("my-queue__empty");
    expect(html).toContain(QUEUE_EMPTY_COPY);
    expect(html).not.toMatch(/queue empty|land here|interrupt/i);
  });

  test("stale is its own state — a stale empty list is flagged, never `empty`", () => {
    const html = renderToString(<QueuePanel source={{ kind: "stale", items: [] }} />);
    expect(html).toContain(QUEUE_STALE_COPY);
    expect(html).not.toContain("my-queue__empty");
    expect(html).not.toContain(QUEUE_EMPTY_COPY);
  });

  test("the three unavailable reasons render distinctly", () => {
    const seen = (["unsupported", "error", "unaddressable"] as const).map((reason) => {
      const html = renderToString(<QueuePanel source={{ kind: "unavailable", reason }} />);
      expect(html).toContain(QUEUE_UNAVAILABLE_COPY[reason]);
      expect(html).not.toContain(QUEUE_EMPTY_COPY);
      return html;
    });
    expect(new Set(seen).size).toBe(3);
  });

  test("a caller's detail is APPENDED, so the distinct base sentence always survives", () => {
    const html = renderToString(
      <QueuePanel
        source={{ kind: "unavailable", reason: "unsupported" }}
        unavailableDetail={{ unsupported: "The daemon is in server mode." }}
      />,
    );
    expect(html).toContain(QUEUE_UNAVAILABLE_COPY.unsupported);
    expect(html).toContain("The daemon is in server mode.");
  });

  test("no detail map can flatten the three reasons into one message", () => {
    const flatten = { unsupported: "Unavailable.", error: "Unavailable.", unaddressable: "Unavailable." };
    const seen = (["unsupported", "error", "unaddressable"] as const).map((reason) =>
      renderToString(<QueuePanel source={{ kind: "unavailable", reason }} unavailableDetail={flatten} />),
    );
    expect(new Set(seen).size).toBe(3);
  });
});

describe("QueueRow — the cancel affordance (invariant 4)", () => {
  const statuses: QueueItemStatus[] = ["queued", "leased", "delivered", "canceled"];

  test("only a queued row the caller permits renders an active cancel control", () => {
    for (const status of statuses) {
      const permitted = renderToString(<QueueRow item={item({ status })} canCancel onArm={noop} />);
      expect(permitted.includes("my-qrow__cancel")).toBe(status === "queued");
      const denied = renderToString(<QueueRow item={item({ status })} onArm={noop} />);
      expect(denied).not.toContain("my-qrow__cancel");
    }
  });

  test("the same holds through the panel", () => {
    for (const status of statuses) {
      const source: QueueSource = { kind: "ok", items: [item({ status })] };
      const html = renderToString(<QueuePanel source={source} canCancel onCancel={noop} />);
      expect(html.includes("my-qrow__cancel")).toBe(status === "queued");
    }
  });

  test("the armed row swaps to the two-step confirm — inline, never a modal", () => {
    const html = renderToString(<QueueRow item={item()} armed canCancel />);
    expect(html).toContain(queueRowClass("queued", true));
    expect(html).toContain("Cancel this delivery?");
    expect(html).toContain("Cancel it");
    expect(html).toContain("Keep");
    expect(html).not.toContain("my-scrim");
  });

test("an armed row that is NOT cancellable renders no active cancel control (invariant 4)", () => {
    // arming a leased/delivered/canceled row, or a row whose permission was revoked, must not
    // produce a live "Cancel it" — including in the render before a disarming effect runs
    for (const status of ["leased", "delivered", "canceled"] as const) {
      const html = renderToString(<QueueRow item={item({ status })} armed canCancel />);
      expect(html).not.toContain("Cancel it");
      expect(html).not.toContain("Cancel this delivery?");
      expect(html).toContain(queueRowClass(status, false));
    }
    const revoked = renderToString(<QueueRow item={item({ status: "queued" })} armed canCancel={false} />);
    expect(revoked).not.toContain("Cancel it");
    expect(revoked).not.toContain("my-qrow__cancel");
  });

  test("rows with a repeated id still render one element each (no key collision)", () => {
    const dup: TermRow[] = [
      { kind: "assistant", text: "first", id: "same" },
      { kind: "assistant", text: "second", id: "same" },
    ];
    const html = renderToString(<Terminal source={{ kind: "ready", rows: dup }} />);
    expect(html).toContain("first");
    expect(html).toContain("second");
  });

  test("badges and row classes come from ui-core", () => {
    expect(renderToString(<QueueRow item={item({ cls: "asap" })} />)).toContain(queueBadgeClass("asap"));
    expect(renderToString(<QueueRow item={item({ cls: "on-done" })} />)).toContain(queueBadgeClass("on-done"));
    for (const status of statuses) {
      expect(renderToString(<QueueRow item={item({ status })} />)).toContain(queueRowClass(status, false));
      expect(renderToString(<QueueRow item={item({ status })} />)).toContain(status); // verbatim label
    }
  });
});

describe("SendBar — the honest delivery hint (invariant 2)", () => {
  test("the hint is rendered verbatim from ui-core when the bar is usable", () => {
    const html = renderToString(<SendBar onSend={sent} />);
    expect(html).toContain(DELIVERY_HINT);
    expect(html).not.toMatch(/interrupt/i);
  });

  test("a disabled bar shows only the caller's honest reason — no per-class semantics", () => {
    const html = renderToString(
      <SendBar disabled disabledReason="Jacob is stopped — restart to message" onSend={sent} />,
    );
    expect(html).not.toContain(DELIVERY_HINT);
    expect(html).toContain("Jacob is stopped — restart to message");
    expect(html).toContain("my-sendbar is-disabled");
  });

  test("the placeholder is ui-core's composition", () => {
    expect(renderToString(<SendBar targetName="Jacob" onSend={sent} />)).toContain(
      sendPlaceholder(false, undefined, "Jacob"),
    );
    expect(renderToString(<SendBar onSend={sent} />)).toContain(sendPlaceholder(false));
  });

  test("both delivery classes are offered, with the default pressed", () => {
    const html = renderToString(<SendBar defaultClass="on-done" onSend={sent} />);
    expect(html).toContain("ASAP");
    expect(html).toContain("ON-DONE");
    expect(html).toContain("my-sendbar__cls is-on");
  });

  test("an optional notice rides below the bar", () => {
    expect(renderToString(<SendBar notice="Stop-turn accepted as pending." onSend={sent} />)).toContain(
      "Stop-turn accepted as pending.",
    );
  });
});

describe("self-containment — every emitted class resolves in ui-core's styles.css", () => {
  const renders = [
    renderToString(<Terminal source={{ kind: "loading" }} />),
    renderToString(<Terminal source={{ kind: "missing" }} />),
    renderToString(<Terminal source={{ kind: "unaddressable" }} />),
    renderToString(<Terminal source={{ kind: "failed" }} />),
    renderToString(<Terminal source={{ kind: "ready", rows }} caret wakeUnavailable turnInFlight onStopTurn={noop} />),
    renderToString(
      <Terminal
        source={{ kind: "stale", rows }}
        name="jacob.jsonl"
        onToggleNoise={noop}
        onStopTurn={noop}
        stopProminent
        turnInFlight={false}
        localRows={[{ kind: "local", text: "— turn interrupted (^C) —" }]}
        history={[{ id: "7f3a11c9", rows: [{ kind: "dim", text: "x" }] }]}
      />,
    ),
    renderToString(<QueuePanel source={{ kind: "loading" }} />),
    renderToString(<QueuePanel source={{ kind: "unavailable", reason: "error" }} />),
    renderToString(<QueuePanel source={{ kind: "ok", items: [] }} />),
    renderToString(<QueuePanel source={{ kind: "stale", items: [item()] }} canCancel onCancel={noop} />),
    renderToString(<QueueRow item={item()} armed canCancel />),
    ...(["queued", "leased", "delivered", "canceled"] as const).map((status) =>
      renderToString(<QueueRow item={item({ status })} canCancel />),
    ),
    renderToString(<SendBar onSend={sent} targetName="Jacob" notice="n" />),
    renderToString(<SendBar disabled disabledReason="r" onSend={sent} />),
  ];

  const emitted = new Set<string>();
  for (const html of renders) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
    }
  }
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  test("the scan sees a real class surface", () => {
    expect(emitted.size).toBeGreaterThan(20);
    for (const c of ["my-term", "my-qrow", "my-qbadge", "my-sendbar"]) expect(emitted.has(c)).toBe(true);
  });

  test("each emitted class matches ≥1 selector in ui-core's styles.css", () => {
    const missing = [...emitted].filter((c) => !new RegExp(`\\.${escapeRe(c)}(?![\\w-])`).test(css));
    expect(missing).toEqual([]);
  });

  test("no export ever emits an inline style attribute (CSP style-src 'self')", () => {
    for (const html of renders) expect(html).not.toContain("style=");
  });
});
