// test/terminal-css.test.ts — the stylesheet half of the terminal set (ds/components-terminal v2).
//
// The general styles.css guards (no hex literals, tokens resolve, additions use --my-fs-* steps)
// live in test/css.test.ts and cover these rules too. This file guards the ONE thing that is
// specific to this component family and is design, not styling:
//
//   INVARIANT 1 — "Terminal surfaces always use the --my-term-* set, regardless of app theme"
//   (ds/tokens rule 3). The terminal is heritage-dark in BOTH themes. That cannot be left to a
//   consumer remembering to pass a theme prop, so it is pinned in CSS: `.my-term` re-points every
//   theme-flipping local onto the fixed --my-term-* palette for its whole subtree, and nothing
//   theme-conditional is allowed to select into it.
//
// It also checks that every class the terminal-set logic emits has a real selector, so a rename in
// src/logic can't silently unstyle the family.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  TERM_CLASS,
  TERM_ROW_KINDS,
  deliveryClassButtonClass,
  queueBadgeClass,
  queueRowClass,
  sendBarClass,
  stopButtonClass,
  termRowClass,
  type QueueItemStatus,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");
const tokensPath = join(import.meta.dir, "..", "..", "..", "..", "mythical-design", "tokens.css");

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(css);
}
/** The body of the first `.my-term { … }` rule. */
function termBlock(): string {
  const m = css.match(/\.my-term\s*\{([^}]*)\}/);
  expect(m).not.toBeNull();
  return m?.[1] ?? "";
}

/** The theme-flipping locals: every one of these has a different value under [data-theme="dark"],
 *  so anything inside the terminal that inherits one would follow the app theme. */
const FLIPPING_LOCALS = [
  "--my-bg",
  "--my-surface",
  "--my-surface-hover",
  "--my-border",
  "--my-control-border",
  "--my-ink",
  "--my-muted",
  "--my-accent",
  "--my-accent-strong",
  "--my-accent-soft",
  "--my-warn",
  "--my-warn-soft",
];

describe("invariant 1 — .my-term pins the heritage palette in BOTH themes", () => {
  test("the terminal surface class has a real rule", () => {
    expect(TERM_CLASS).toBe("my-term");
    expect(hasClassSelector(TERM_CLASS)).toBe(true);
  });

  test("its own surface and ink come from --my-term-*, not from the theme locals", () => {
    const block = termBlock();
    expect(block).toMatch(/background:\s*var\(--my-term-bg\)/);
    expect(block).toMatch(/color:\s*var\(--my-term-ink\)/);
  });

  test("it re-points EVERY theme-flipping local onto the fixed term palette", () => {
    const block = termBlock();
    const missing = FLIPPING_LOCALS.filter((name) => !new RegExp(`${escapeRegex(name)}\\s*:`).test(block));
    expect(missing).toEqual([]);
  });

  test("each re-pointed local resolves through a --my-term-* token, never a theme token", () => {
    const block = termBlock();
    for (const name of FLIPPING_LOCALS) {
      const decl = block.match(new RegExp(`${escapeRegex(name)}\\s*:([^;]+);`));
      expect(decl).not.toBeNull();
      const value = decl?.[1] ?? "";
      // every var() reference in the value must be a --my-term-* token
      const refs = Array.from(value.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]!);
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.filter((r) => !r.startsWith("--my-term-"))).toEqual([]);
    }
  });

  test("NO theme-conditional selector may reach into the terminal", () => {
    // a `[data-theme="dark"] .my-term…` or `.my-dark .my-term…` rule would reintroduce exactly the
    // theme dependence rule 3 forbids
    const offenders = Array.from(css.matchAll(/^[^\n{]*(?:\[data-theme|\.my-dark)[^\n{]*\{/gm))
      .map((m) => m[0])
      .filter((selector) => /\.my-term/.test(selector));
    expect(offenders).toEqual([]);
  });

  test("the canonical tokens.css does NOT override --my-term-* in the dark theme", () => {
    // the pin above only holds because the term palette is theme-invariant upstream too
    if (!existsSync(tokensPath)) return; // sibling design repo not checked out — covered elsewhere
    const tokens = readFileSync(tokensPath, "utf8");
    const darkStart = tokens.search(/\[data-theme="dark"\]/);
    expect(darkStart).toBeGreaterThan(-1);
    const dark = tokens.slice(darkStart);
    expect(dark).not.toMatch(/--my-term-[a-z-]+\s*:/);
    // and they ARE defined in :root
    expect(tokens.slice(0, darkStart)).toMatch(/--my-term-bg\s*:/);
  });
});

describe("every class the terminal-set logic emits has a selector", () => {
  function expectSelectorsFor(classString: string) {
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      expect(hasClassSelector(token)).toBe(true);
    }
  }

  test("terminal row kinds", () => {
    for (const kind of TERM_ROW_KINDS) expectSelectorsFor(termRowClass(kind));
  });

  test("stop control, send bar, delivery segment", () => {
    for (const prominent of [true, false]) expectSelectorsFor(stopButtonClass(prominent));
    for (const disabled of [true, false]) expectSelectorsFor(sendBarClass(disabled));
    for (const selected of [true, false]) expectSelectorsFor(deliveryClassButtonClass(selected));
  });

  test("queue rows and badges, across every status", () => {
    const statuses: QueueItemStatus[] = ["queued", "leased", "delivered", "canceled"];
    for (const status of statuses) {
      expectSelectorsFor(queueRowClass(status, false));
      expectSelectorsFor(queueRowClass(status, true));
    }
    for (const cls of ["asap", "on-done"] as const) expectSelectorsFor(queueBadgeClass(cls));
  });

  test("the structural classes the bindings render", () => {
    const structural = [
      "my-term__titlebar",
      "my-term__lights",
      "my-term__light",
      "my-term__light--r",
      "my-term__light--a",
      "my-term__light--g",
      "my-term__noise",
      "my-term__title",
      "my-term__tb-right",
      "my-term__turn",
      "my-term__turn-dot",
      "my-term__idle",
      "my-term__stop-key",
      "my-term__body",
      "my-term__banner",
      "my-term__banner-dot",
      "my-term__state",
      "my-term__label",
      "my-term__head",
      "my-term__expand",
      "my-term__detail",
      "my-term__more",
      "my-term__hist",
      "my-term__hist-cap",
      "my-term__caret",
      "my-queue",
      "my-queue__list",
      "my-queue__state",
      "my-queue__stale",
      "my-queue__empty",
      "my-qrow__body",
      "my-qrow__status",
      "my-qrow__cancel",
      "my-qrow__ask",
      "my-qrow__acts",
      "my-qmini",
      "my-qmini--yes",
      "my-qmini--no",
      "my-sendbar-wrap",
      "my-sendbar__seg",
      "my-sendbar__input",
      "my-sendbar__send",
      "my-sendbar__hint",
      "my-sendbar__notice",
    ];
    const missing = structural.filter((c) => !hasClassSelector(c));
    expect(missing).toEqual([]);
  });
});

describe("motion respects prefers-reduced-motion", () => {
  test("the blinking caret and the pulsing dots are paused", () => {
    const block = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*my-term__caret[^}]*\}/);
    expect(block).not.toBeNull();
    for (const c of ["my-term__caret", "my-term__banner-dot", "my-term__turn-dot"]) {
      expect(block?.[0]).toContain(c);
    }
    expect(block?.[0]).toMatch(/animation:\s*none/);
  });
});
