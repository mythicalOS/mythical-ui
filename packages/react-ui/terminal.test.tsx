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
  TERM_CLASSES,
  TERM_COPIED_ARIA,
  TERM_COPIED_LABEL,
  TERM_COPY_ARIA,
  TERM_COPY_LABEL,
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
  TERM_ROW_KINDS,
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

/** A hand-aligned report block. `detail` is set ON PURPOSE: block precedence must eat it. */
const blockRow: TermRow = {
  kind: "system",
  label: "report",
  block: true,
  detail: "must never grow an expand affordance",
  text: "Handoff(s):        none found — degraded mode\nPickup point:      cold start; no prior session state",
  id: "blk1",
};

/** A rich-span body. `text` carries the SAME content as plain text — the model's contract: it is
 *  the fallback and what every text path reads; the spans render INSTEAD of it. */
const spanRow: TermRow = {
  kind: "assistant",
  label: "▍assistant",
  text: "the frozen surface stays read-only — verify with bun test",
  spans: [
    { t: "text", s: "the " },
    { t: "bold", s: "frozen surface" },
    { t: "text", s: " stays read-only — verify with " },
    { t: "code", s: "bun test" },
  ],
  id: "sp1",
};

/** Run `fn` with a (working) clipboard installed on globalThis, restoring the real one after —
 *  the copy control is feature-guarded, and bun's environment has no `navigator.clipboard`. */
function withClipboard<T>(fn: () => T): T {
  const host = globalThis as { navigator?: unknown };
  const original = host.navigator;
  host.navigator = { clipboard: { writeText: async () => {} } };
  try {
    return fn();
  } finally {
    host.navigator = original;
  }
}

/** Run `fn` with the clipboard EXPLICITLY absent (rather than trusting the environment). */
function withoutClipboard<T>(fn: () => T): T {
  const host = globalThis as { navigator?: unknown };
  const original = host.navigator;
  host.navigator = {};
  try {
    return fn();
  } finally {
    host.navigator = original;
  }
}

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

describe("Terminal — the recv/send/memory row kinds (ds/components-terminal §4.1)", () => {
  test("recv/send/memory row kinds exist and are enumerated", () => {
    expect(TERM_ROW_KINDS).toContain("recv");
    expect(TERM_ROW_KINDS).toContain("send");
    expect(TERM_ROW_KINDS).toContain("memory");
    expect(TERM_ROW_KINDS.length).toBe(11); // 8 existing + 3
    expect(termRowClass("recv")).toBe("my-term__row my-term__row--recv");
    expect(termRowClass("send")).toBe("my-term__row my-term__row--send");
    expect(termRowClass("memory")).toBe("my-term__row my-term__row--memory");
  });

  // The headline requirement, pinned BY VALUE not by selector existence: these kinds exist
  // precisely because their label must NOT be forced to the body colour.
  test("each new kind's label declaration differs from its body declaration", () => {
    // `css` is the file's existing module-scope read of ui-core/styles.css.
    /** The `var(--token)` form — the five declarations that use it. */
    const decl = (sel: string) => {
      const m = new RegExp(`\\${sel}\\s*\\{[^}]*color:\\s*var\\((--[a-z-]+)\\)`).exec(css);
      return m?.[1] ?? null;
    };
    expect(decl(".my-term__row--recv")).toBe("--my-term-ink");
    expect(decl(".my-term__row--recv .my-term__label")).toBe("--my-term-user");
    expect(decl(".my-term__row--send")).toBe("--my-term-dim");
    expect(decl(".my-term__row--send .my-term__label")).toBe("--my-term-assistant");
    expect(decl(".my-term__row--memory")).toBe("--my-term-dim");
    // the property that actually matters, and that selector-existence checks cannot catch:
    expect(decl(".my-term__row--recv")).not.toBe(decl(".my-term__row--recv .my-term__label"));
    expect(decl(".my-term__row--send")).not.toBe(decl(".my-term__row--send .my-term__label"));
  });

  // The SIXTH declaration needs its own matcher: its value starts `color-mix(`, so the `decl()`
  // probe above returns null for it — and a bare "they differ" assertion against a null would pass
  // vacuously against a MISSING declaration. Match the declaration text itself.
  test("the memory label is the sanctioned color-mix over term tokens, not a token or a hex", () => {
    const m = /\.my-term__row--memory \.my-term__label\s*\{([^}]*)\}/.exec(css);
    expect(m).not.toBeNull();
    const value = /color:\s*([^;]+);/.exec(m![1]!)?.[1]?.trim() ?? "";
    expect(value).toBe("color-mix(in oklab, var(--my-term-assistant) 45%, var(--my-term-user))");
    // and it is NOT the body's declaration — the whole point of the kind
    expect(value).not.toBe("var(--my-term-dim)");
    // every var() operand inside it is a --my-term-* token, which is what keeps
    // ui-core's test/terminal-css.test.ts flipping-token rule green
    const refs = Array.from(value.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)).map((x) => x[1]!);
    expect(refs).toEqual(["--my-term-assistant", "--my-term-user"]);
  });

  // "both bindings render them identically". The two tests above do NOT prove this: they exercise
  // ui-core's shared TERM_ROW_KINDS/termRowClass and the stylesheet text, none of which is
  // per-binding. The main render fixture contains none of the new kinds, so a binding could drop
  // or mangle one with everything above green. Render them.
  test("the binding renders all three new kinds through ui-core's row classes", () => {
    const newRows: TermRow[] = [
      { kind: "recv", label: "← @ lead-4❯ (14:32:05)", text: "\n  hi" },
      { kind: "send", label: "→ @ qa-6❯ (14:32:06)", text: "\n  ok" },
      { kind: "memory", label: "⊕ memory · stored (14:35:02)", text: "" },
    ];
    // ONE row per render, asserting that row's OWN class and the ABSENCE of the other two: a
    // rendering that cycled the kinds (recv→send, send→memory, memory→recv) would satisfy a
    // combined "contains all three" scan while mapping every row to the wrong hue.
    for (const row of newRows) {
      for (const noiseFilterEnabled of [false, true]) {
        const one = rts(
          <Terminal source={{ kind: "ready", rows: [row] }} noiseFilterEnabled={noiseFilterEnabled} />,
        );
        expect(one).toContain(termRowClass(row.kind));
        for (const other of newRows) {
          if (other.kind !== row.kind) expect(one).not.toContain(termRowClass(other.kind));
        }
        // and none of the three is silently noise-filtered away
        expect(one).not.toContain(TERM_NO_EVENTS_COPY);
      }
    }
    // the label really renders as a label — that element is what carries the contrasting colour
    const html = rts(<Terminal source={{ kind: "ready", rows: newRows }} />);
    expect(html).toContain("← @ lead-4❯");
    expect(html).toContain("my-term__label");
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

describe("Terminal — block rows (structured report blocks) and the copy affordance", () => {
  test("a block row renders its text inside the preformatted inset panel, alignment verbatim", () => {
    const html = rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />);
    expect(html).toContain(`class="${TERM_CLASSES.block}"`);
    expect(html).toContain(`class="${TERM_CLASSES.blockPre}"`);
    // the hand-aligned run of spaces survives byte-for-byte — the whole point of the block
    expect(html).toContain("Handoff(s):        none found — degraded mode");
    expect(html).toContain("Pickup point:      cold start; no prior session state");
  });

  test("the row keeps its kind class and its label", () => {
    const html = rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />);
    expect(html).toContain(termRowClass("system"));
    expect(html).toContain(`class="${TERM_CLASSES.label}"`);
    expect(html).toContain("report");
  });

  test("`block` takes precedence over `detail` — no expand affordance, no detail pane", () => {
    const html = rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />);
    expect(html).not.toContain(`class="${TERM_CLASSES.head}"`);
    expect(html).not.toContain("(expand)");
    expect(html).not.toContain(`class="${TERM_CLASSES.detail}"`);
    expect(html).not.toContain("must never grow an expand affordance");
  });

  test("the copy control is feature-guarded: present with a clipboard, NOTHING without one", () => {
    const withOne = withClipboard(() => rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />));
    expect(withOne).toContain(`class="${TERM_CLASSES.copy}"`);
    expect(withOne).toContain(`aria-label="${TERM_COPY_ARIA}"`); // resting accessible name (copyAria(false))
    expect(withOne).toContain(`>${TERM_COPY_LABEL}</button>`); // resting label, from ui-core
    expect(withOne).not.toContain(TERM_COPIED_LABEL); // never claims a copy that has not happened
    expect(withOne).not.toContain(TERM_COPIED_ARIA); // — not in the accessible name either
    const withoutOne = withoutClipboard(() => rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />));
    expect(withoutOne).not.toContain(TERM_CLASSES.copy);
    expect(withoutOne).not.toContain(TERM_COPY_ARIA);
    // the block itself still renders — only the control is clipboard-gated
    expect(withoutOne).toContain(`class="${TERM_CLASSES.blockPre}"`);
  });
});

describe("Terminal — rich-span rows (the constrained structured body)", () => {
  test("a mixed bold/code/text run renders <b>, <code> (ui-core's codespan class) and plain text — nothing else", () => {
    const html = rts(<Terminal source={{ kind: "ready", rows: [spanRow] }} />);
    expect(html).toContain(
      `the <b>frozen surface</b> stays read-only — verify with <code class="${TERM_CLASSES.codeSpan}">bun test</code>`,
    );
    // the spans render INSTEAD of the plain text, which never appears as one contiguous run
    expect(html).not.toContain(spanRow.text);
    // and the raw markdown the model replaces never leaks through
    expect(html).not.toContain("**");
    expect(html).not.toContain("`bun test`");
  });

  test("spans work on EVERY row kind — the kind class still carries the hue", () => {
    const system: TermRow = { ...spanRow, kind: "system", label: undefined, id: "sp2" };
    const html = rts(<Terminal source={{ kind: "ready", rows: [system] }} />);
    expect(html).toContain(termRowClass("system"));
    expect(html).toContain("<b>frozen surface</b>");
    expect(html).toContain(`class="${TERM_CLASSES.codeSpan}"`);
  });

  test("an expandable row renders its spans in the button HEAD; the expand affordance survives", () => {
    const expandable: TermRow = { ...spanRow, detail: "bun test src/delivery", id: "sp3" };
    const html = rts(<Terminal source={{ kind: "ready", rows: [expandable] }} />);
    const head = html.match(new RegExp(`<button[^>]*class="${TERM_CLASSES.head}"[^>]*>[\\s\\S]*?</button>`))?.[0] ?? "";
    expect(head).toContain("<b>frozen surface</b>");
    expect(head).toContain(`class="${TERM_CLASSES.codeSpan}"`);
    expect(head).toContain("(expand)");
    // collapsed: the detail pane is not rendered
    expect(html).not.toContain(`class="${TERM_CLASSES.detail}"`);
  });

  test("a block row IGNORES spans — `block` > `spans`, its text renders preformatted verbatim", () => {
    const blockWithSpans: TermRow = { ...blockRow, spans: spanRow.spans, id: "sp4" };
    const html = rts(<Terminal source={{ kind: "ready", rows: [blockWithSpans] }} />);
    expect(html).toContain(`class="${TERM_CLASSES.blockPre}"`);
    expect(html).toContain("Handoff(s):        none found — degraded mode");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain(TERM_CLASSES.codeSpan);
  });

  test("span content is TEXT — markup inside a span renders escaped, never parsed", () => {
    const hostile: TermRow = {
      kind: "assistant",
      text: '<img src=x onerror=alert(1)> and <b>y</b>',
      spans: [
        { t: "code", s: "<img src=x onerror=alert(1)>" },
        { t: "text", s: " and " },
        { t: "bold", s: "<b>y</b>" },
      ],
      id: "sp5",
    };
    const html = rts(<Terminal source={{ kind: "ready", rows: [hostile] }} />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>y</b>"); // the bold span's CONTENT is escaped text, not markup
    expect(html).toContain("&lt;img");
  });

  test("a malformed run falls back to the row's plain text — nothing dropped, nothing guessed", () => {
    const malformed: TermRow = {
      ...spanRow,
      spans: [...spanRow.spans!, { t: "html", s: "<b>x</b>" }] as unknown as TermRow["spans"],
      id: "sp6",
    };
    const html = rts(<Terminal source={{ kind: "ready", rows: [malformed] }} />);
    expect(html).toContain(spanRow.text); // the contiguous plain text IS the render
    expect(html).not.toContain("<b>");
    expect(html).not.toContain(TERM_CLASSES.codeSpan);
  });
});

// The scroll/click wiring cannot run under renderToStaticMarkup (no layout, no events), so — per
// this package's convention (hooks.test.ts, diff r4-F1) — it is pinned by a BINDING source scan
// run against the comment-stripped source, so only live code can satisfy a required pattern.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("Terminal — follow-tail + copy wiring (source scan, comment-stripped)", () => {
  const src = stripComments(readFileSync(join(import.meta.dir, "src", "Terminal.tsx"), "utf8"));

  test("followTail defaults TRUE — scrolling up is the escape, not a prop", () => {
    expect(src).toContain("props.followTail !== false");
  });

  test("following-state rides the body's scroll events through ui-core's nearBottom, threshold included", () => {
    expect(src).toMatch(/addEventListener\("scroll", onScroll\)/);
    expect(src).toMatch(/removeEventListener\("scroll", onScroll\)/); // and the listener is removed
    expect(src).toMatch(
      /nearBottom\(el\.scrollTop, el\.scrollHeight, el\.clientHeight, FOLLOW_TAIL_THRESHOLD_PX\)/,
    );
  });

  test("content changes pin the body to the bottom ONLY while following", () => {
    expect(src).toMatch(/if \(!followTail \|\| !followRef\.current\) return;/);
    expect(src).toMatch(/el\.scrollTop = el\.scrollHeight/);
  });

  test("the pin effect depends on ui-core's ONE content revision — every content input wired", () => {
    // The revision call must wire EVERY input the body renders from; this scan fails if any field
    // drops out — in particular `currentWakeOnly` and the expand state, the two an enumerated
    // dependency list silently lost.
    expect(src).toMatch(
      /termContentRevision\(\{\s*view,\s*rows,\s*localRows,\s*history,\s*showHistory,\s*wakeUnavailable: props\.wakeUnavailable === true,\s*caret: props\.caret === true,\s*currentWakeOnly: props\.currentWakeOnly === true,\s*noiseFilter: noiseFilterEnabled,\s*expandedCount: expanded\.size,?\s*\}\)/,
    );
    // and the effect watches that revision — not a re-enumeration of raw inputs
    expect(src).toMatch(/\[followTail, contentRevision\]\);/);
  });

  test("'copied ✓' is claimed only for a write that actually resolved, and reverts on ui-core's clock", () => {
    expect(src).toContain("termClipboardWriter(globalThis)");
    expect(src).toContain("await write(row.text)"); // the row's text, verbatim
    expect(src).toMatch(/setTimeout\(\(\) => setCopied\(false\), TERM_COPIED_REVERT_MS\)/);
  });

  test("the copy control's accessible name flips WITH the visible label — both from ui-core", () => {
    expect(src).toContain("aria-label={copyAria(copied)}");
    expect(src).toContain("{copyLabel(copied)}");
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

  test("a caller's detail is APPENDED, so the distinct base sentence always survives", () => {
    const html = rts(
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
      rts(<QueuePanel source={{ kind: "unavailable", reason }} unavailableDetail={flatten} />),
    );
    expect(new Set(seen).size).toBe(3);
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

  test("a STALE list renders its rows WITHOUT any cancel control", () => {
    // the row is still shown (stale is its own state, flagged), but its status is last-known data,
    // so offering a cancel would contradict the banner right above it
    const html = rts(
      <QueuePanel source={{ kind: "stale", items: [item({ status: "queued" })] }} canCancel onCancel={noop} />,
    );
    expect(html).toContain(QUEUE_STALE_COPY);
    expect(html).toContain("re-run the fold matrix"); // the row IS rendered
    expect(html).not.toContain("my-qrow__cancel"); // but with no live cancel
    // the same list from a FRESH read does carry the control
    const fresh = rts(
      <QueuePanel source={{ kind: "ok", items: [item({ status: "queued" })] }} canCancel onCancel={noop} />,
    );
    expect(fresh).toContain("my-qrow__cancel");
  });

  test("the armed row swaps to the two-step confirm — inline, never a modal", () => {
    const html = rts(<QueueRow item={item()} armed canCancel />);
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
      const html = rts(<QueueRow item={item({ status })} armed canCancel />);
      expect(html).not.toContain("Cancel it");
      expect(html).not.toContain("Cancel this delivery?");
      expect(html).toContain(queueRowClass(status, false));
    }
    const revoked = rts(<QueueRow item={item({ status: "queued" })} armed canCancel={false} />);
    expect(revoked).not.toContain("Cancel it");
    expect(revoked).not.toContain("my-qrow__cancel");
  });

  test("rows with a repeated id still render one element each (no key collision)", () => {
    const dup: TermRow[] = [
      { kind: "assistant", text: "first", id: "same" },
      { kind: "assistant", text: "second", id: "same" },
    ];
    const html = rts(<Terminal source={{ kind: "ready", rows: dup }} />);
    expect(html).toContain("first");
    expect(html).toContain("second");
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

  test("a busy bar cannot send — the control is inert while a delivery is in flight", () => {
    const html = rts(<SendBar busy onSend={sent} />);
    expect(html).toMatch(/<button[^>]*my-sendbar__send[^>]*disabled/);
    // the bar is still ENABLED (the field stays editable mid-send), so the honest hint stays
    expect(html).toContain(DELIVERY_HINT);
    expect(html).not.toContain("my-sendbar is-disabled");
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
    // the block row + its copy control (clipboard present, so the control's class is emitted)
    withClipboard(() => rts(<Terminal source={{ kind: "ready", rows: [blockRow] }} />)),
    // a rich-span row, so the codespan class joins the scan
    rts(<Terminal source={{ kind: "ready", rows: [spanRow] }} />),
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
