// packages/react-ui/terminal.test.tsx — the terminal set's React binding (ds/components-terminal
// v2): Terminal · QueueRow/QueuePanel · SendBar.
//
// Mirrors packages/preact-ui/terminal.test.tsx. The state machines and the honesty rules are proven
// DOM-free in ui-core's test/logic/terminal.test.ts; what is proven here is that THIS binding
// renders what ui-core resolved — the same anti-drift guarantee parity.test.tsx makes for the older
// atoms: every class string and every copy string is core-derived, never restated locally.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
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
/**
 * react-dom/server escapes `'` to `&#x27;` (and `&` to `&amp;`) in text nodes, so a raw markup
 * string never literally contains copy like "can't". Decoding just those two entities lets the copy
 * assertions below compare against the REAL ui-core strings instead of a React-specific encoding —
 * the point of the test is the copy, not the escaping.
 */
const rts = (el: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(el).replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

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
      const html = rts(el);
      expect(html.match(/^<div class="([^"]*)"/)?.[1]).toBe(TERM_CLASS);
    }
  });
});

describe("Terminal — the six source branches (loading honesty)", () => {
  test("loading renders its own copy and NEVER `(no events)`", () => {
    const html = rts(<Terminal source={{ kind: "loading" }} />);
    expect(html).toContain(TERM_LOADING_COPY);
    expect(html).not.toContain(TERM_NO_EVENTS_COPY);
  });

  test("missing / unaddressable / failed render three DISTINCT states", () => {
    expect(rts(<Terminal source={{ kind: "missing" }} />)).toContain(TERM_MISSING_COPY);
    expect(rts(<Terminal source={{ kind: "unaddressable" }} />)).toContain(TERM_UNADDRESSABLE_COPY);
    expect(rts(<Terminal source={{ kind: "failed" }} />)).toContain(TERM_FAILED_COPY);
    const missing = rts(<Terminal source={{ kind: "missing" }} />);
    expect(missing).not.toContain(TERM_FAILED_COPY);
    expect(missing).not.toContain(TERM_UNADDRESSABLE_COPY);
  });

  test("ready renders rows through ui-core's row classes; noise obeys the filter", () => {
    const shown = rts(<Terminal source={{ kind: "ready", rows }} noiseFilterEnabled={false} />);
    expect(shown).toContain(termRowClass("assistant"));
    expect(shown).toContain(termRowClass("user"));
    expect(shown).toContain(termRowClass("tool"));
    expect(shown).toContain("thinking_tokens");
    const hidden = rts(<Terminal source={{ kind: "ready", rows }} noiseFilterEnabled />);
    expect(hidden).not.toContain("thinking_tokens");
  });

  test("stale renders the log AND flags itself, with no retry claim", () => {
    const html = rts(<Terminal source={{ kind: "stale", rows }} />);
    expect(html).toContain(TERM_STALE_COPY);
    expect(html).toContain(termRowClass("assistant"));
    expect(html).not.toMatch(/reconnect|retrying/i);
  });

  test("an empty ready log says `(no events)`", () => {
    expect(rts(<Terminal source={{ kind: "ready", rows: [] }} />)).toContain(TERM_NO_EVENTS_COPY);
  });
});

describe("Terminal — wake banner (invariant 6) and the turn caption", () => {
  test("the wake banner says exactly `wake unavailable`, never a retry", () => {
    const html = rts(<Terminal source={{ kind: "ready", rows }} wakeUnavailable />);
    expect(html).toContain(TERM_WAKE_UNAVAILABLE_COPY);
    expect(html).not.toMatch(/reconnect|retrying|\(\d+\/\d+\)/i);
    expect(rts(<Terminal source={{ kind: "loading" }} wakeUnavailable />)).toContain(
      TERM_WAKE_UNAVAILABLE_COPY,
    );
  });

  test("the turn caption renders only from supplied truth", () => {
    expect(rts(<Terminal source={{ kind: "ready", rows }} turnInFlight />)).toContain(
      TURN_IN_FLIGHT_COPY,
    );
    expect(rts(<Terminal source={{ kind: "ready", rows }} turnInFlight={false} />)).toContain(
      TURN_IDLE_COPY,
    );
    const unknown = rts(<Terminal source={{ kind: "ready", rows }} />);
    expect(unknown).not.toContain(TURN_IN_FLIGHT_COPY);
    expect(unknown).not.toContain(TURN_IDLE_COPY);
  });
});

describe("Terminal — title bar, stop control, history disclosure", () => {
  test("the title line is ui-core's composition; a read-only pane gets a caption, not a dead button", () => {
    const interactive = rts(
      <Terminal source={{ kind: "ready", rows }} name="jacob.jsonl" noiseFilterEnabled onToggleNoise={noop} />,
    );
    expect(interactive).toContain(termTitleText("jacob.jsonl", true));
    expect(interactive).toContain('class="my-term__noise"');
    const readOnly = rts(<Terminal source={{ kind: "ready", rows }} name="jacob.jsonl" />);
    expect(readOnly).toContain('class="my-term__title"');
    expect(readOnly).not.toContain('class="my-term__noise"');
  });

  test("no stop handler ⇒ no stop control at all", () => {
    expect(rts(<Terminal source={{ kind: "ready", rows }} />)).not.toContain("my-term__stop");
    expect(rts(<Terminal source={{ kind: "ready", rows }} onStopTurn={noop} />)).toContain(
      "my-term__stop",
    );
    expect(
      rts(<Terminal source={{ kind: "ready", rows }} onStopTurn={noop} stopProminent />),
    ).toContain("my-term__stop is-prominent");
  });

  test("foreign segments stay behind the disclosure and are never blended into the log", () => {
    const history = [{ id: "7f3a11c9", rows: [{ kind: "assistant" as const, text: "a foreign line" }] }];
    const html = rts(<Terminal source={{ kind: "ready", rows }} history={history} />);
    expect(html).toContain("↑ show other sessions in this transcript (1)");
    expect(html).not.toContain("a foreign line");
    expect(html).not.toContain("my-term__hist-cap");
  });

  test("currentWakeOnly renders from the last boundary on", () => {
    const withOld: TermRow[] = [{ kind: "assistant", text: "before the wake" }, ...rows];
    const html = rts(<Terminal source={{ kind: "ready", rows: withOld }} currentWakeOnly />);
    expect(html).not.toContain("before the wake");
    expect(html).toContain("seam refactor green");
  });

  test("the caret is opt-in", () => {
    expect(rts(<Terminal source={{ kind: "ready", rows }} />)).not.toContain("my-term__caret");
    expect(rts(<Terminal source={{ kind: "ready", rows }} caret />)).toContain("my-term__caret");
  });
});

describe("QueuePanel — source→view honesty (invariant 3)", () => {
  test("loading renders the loading state, never the empty presentation", () => {
    const html = rts(<QueuePanel source={{ kind: "loading" }} />);
    expect(html).toContain(QUEUE_LOADING_COPY);
    expect(html).not.toContain("my-queue__empty");
    expect(html).not.toContain(QUEUE_EMPTY_COPY);
  });

  test("ok + zero items is the only path to the capability-neutral empty copy", () => {
    const html = rts(<QueuePanel source={{ kind: "ok", items: [] }} />);
    expect(html).toContain("my-queue__empty");
    expect(html).toContain(QUEUE_EMPTY_COPY);
    expect(html).not.toMatch(/queue empty|land here|interrupt/i);
  });

  test("stale is its own state — a stale empty list is flagged, never `empty`", () => {
    const html = rts(<QueuePanel source={{ kind: "stale", items: [] }} />);
    expect(html).toContain(QUEUE_STALE_COPY);
    expect(html).not.toContain("my-queue__empty");
    expect(html).not.toContain(QUEUE_EMPTY_COPY);
  });

  test("the three unavailable reasons render distinctly", () => {
    const seen = (["unsupported", "error", "unaddressable"] as const).map((reason) => {
      const html = rts(<QueuePanel source={{ kind: "unavailable", reason }} />);
      expect(html).toContain(QUEUE_UNAVAILABLE_COPY[reason]);
      expect(html).not.toContain(QUEUE_EMPTY_COPY);
      return html;
    });
    expect(new Set(seen).size).toBe(3);
  });
});

describe("QueueRow — the cancel affordance (invariant 4)", () => {
  const statuses: QueueItemStatus[] = ["queued", "leased", "delivered", "canceled"];

  test("only a queued row the caller permits renders an active cancel control", () => {
    for (const status of statuses) {
      const permitted = rts(<QueueRow item={item({ status })} canCancel onArm={noop} />);
      expect(permitted.includes("my-qrow__cancel")).toBe(status === "queued");
      const denied = rts(<QueueRow item={item({ status })} onArm={noop} />);
      expect(denied).not.toContain("my-qrow__cancel");
    }
  });

  test("the same holds through the panel", () => {
    for (const status of statuses) {
      const source: QueueSource = { kind: "ok", items: [item({ status })] };
      const html = rts(<QueuePanel source={source} canCancel onCancel={noop} />);
      expect(html.includes("my-qrow__cancel")).toBe(status === "queued");
    }
  });

  test("the armed row swaps to the two-step confirm — inline, never a modal", () => {
    const html = rts(<QueueRow item={item()} armed canCancel />);
    expect(html).toContain(queueRowClass("queued", true));
    expect(html).toContain("Cancel this delivery?");
    expect(html).toContain("Cancel it");
    expect(html).toContain("Keep");
    expect(html).not.toContain("my-scrim");
  });

  test("badges and row classes come from ui-core", () => {
    expect(rts(<QueueRow item={item({ cls: "asap" })} />)).toContain(queueBadgeClass("asap"));
    expect(rts(<QueueRow item={item({ cls: "on-done" })} />)).toContain(queueBadgeClass("on-done"));
    for (const status of statuses) {
      expect(rts(<QueueRow item={item({ status })} />)).toContain(queueRowClass(status, false));
      expect(rts(<QueueRow item={item({ status })} />)).toContain(status);
    }
  });
});

describe("SendBar — the honest delivery hint (invariant 2)", () => {
  test("the hint is rendered verbatim from ui-core when the bar is usable", () => {
    const html = rts(<SendBar onSend={sent} />);
    expect(html).toContain(DELIVERY_HINT);
    expect(html).not.toMatch(/interrupt/i);
  });

  test("a disabled bar shows only the caller's honest reason — no per-class semantics", () => {
    const html = rts(
      <SendBar disabled disabledReason="Jacob is stopped — restart to message" onSend={sent} />,
    );
    expect(html).not.toContain(DELIVERY_HINT);
    expect(html).toContain("Jacob is stopped — restart to message");
    expect(html).toContain("my-sendbar is-disabled");
  });

  test("the placeholder is ui-core's composition", () => {
    expect(rts(<SendBar targetName="Jacob" onSend={sent} />)).toContain(
      sendPlaceholder(false, undefined, "Jacob"),
    );
    expect(rts(<SendBar onSend={sent} />)).toContain(sendPlaceholder(false));
  });

  test("both delivery classes are offered, with the default pressed", () => {
    const html = rts(<SendBar defaultClass="on-done" onSend={sent} />);
    expect(html).toContain("ASAP");
    expect(html).toContain("ON-DONE");
    expect(html).toContain("my-sendbar__cls is-on");
  });
});

describe("self-containment — every emitted class resolves in ui-core's styles.css", () => {
  const renders = [
    rts(<Terminal source={{ kind: "loading" }} />),
    rts(<Terminal source={{ kind: "missing" }} />),
    rts(<Terminal source={{ kind: "unaddressable" }} />),
    rts(<Terminal source={{ kind: "failed" }} />),
    rts(
      <Terminal source={{ kind: "ready", rows }} caret wakeUnavailable turnInFlight onStopTurn={noop} />,
    ),
    rts(
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
    rts(<QueuePanel source={{ kind: "loading" }} />),
    rts(<QueuePanel source={{ kind: "unavailable", reason: "error" }} />),
    rts(<QueuePanel source={{ kind: "ok", items: [] }} />),
    rts(<QueuePanel source={{ kind: "stale", items: [item()] }} canCancel onCancel={noop} />),
    rts(<QueueRow item={item()} armed canCancel />),
    ...(["queued", "leased", "delivered", "canceled"] as const).map((status) =>
      rts(<QueueRow item={item({ status })} canCancel />),
    ),
    rts(<SendBar onSend={sent} targetName="Jacob" notice="n" />),
    rts(<SendBar disabled disabledReason="r" onSend={sent} />),
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
