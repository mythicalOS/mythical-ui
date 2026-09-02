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

/** Strip CSS comments so a token name mentioned in prose is never mistaken for a declaration. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * The theme-flipping set, DERIVED rather than hand-listed: every --my-* token the canonical
 * tokens.css re-declares under [data-theme="dark"] has a different value in the two themes, so
 * anything inside the terminal resolving one of them would follow the app theme. Deriving it is the
 * point — a hand-maintained allowlist silently stops covering tokens added upstream later.
 *
 * The fallback is a SNAPSHOT of that set (tokens v0.5.16), so the guard still runs when the sibling
 * design repo is not checked out beside this one; `flippingIsDerived` records which source was
 * used. A snapshot goes stale by doing nothing, and a stale one silently narrows the guard in
 * exactly the checkout that cannot notice — so "the snapshot still matches the canonical set" is
 * itself a test below, run whenever the sibling IS present.
 */
const FALLBACK_FLIPPING = [
  "--my-bg", "--my-surface", "--my-border", "--my-control-border", "--my-track", "--my-ink",
  "--my-muted", "--my-accent", "--my-accent-strong", "--my-accent-soft", "--my-ok", "--my-warn",
  "--my-error", "--my-info", "--my-ink-hover", "--my-accent-hover", "--my-surface-hover",
  "--my-disabled-bg", "--my-disabled-ink", "--my-ok-soft", "--my-warn-soft", "--my-error-soft",
  "--my-info-soft", "--my-scrim", "--my-shadow-modal", "--my-shadow-knob", "--my-tone-ink",
];
const flippingIsDerived = existsSync(tokensPath);
const FLIPPING: Set<string> = (() => {
  if (!flippingIsDerived) return new Set(FALLBACK_FLIPPING);
  const tokens = stripComments(readFileSync(tokensPath, "utf8"));
  const darkStart = tokens.search(/\[data-theme="dark"\]/);
  if (darkStart < 0) return new Set(FALLBACK_FLIPPING);
  return new Set(
    Array.from(tokens.slice(darkStart).matchAll(/(--my-[a-zA-Z0-9-]+)\s*:/g)).map((m) => m[1]!),
  );
})();

/** The flipping tokens `.my-term` actually re-points onto the term palette. */
function repointed(): string[] {
  const block = stripComments(termBlock());
  return Array.from(block.matchAll(/(--my-[a-zA-Z0-9-]+)\s*:/g))
    .map((m) => m[1]!)
    .filter((name) => FLIPPING.has(name));
}

/** Every rule whose selector mentions `.my-term`, as {selector, body} pairs. */
function termRules(): { selector: string; body: string }[] {
  return Array.from(stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
    .filter((r) => /\.my-term/.test(r.selector));
}

describe("invariant 1 — .my-term pins the heritage palette in BOTH themes", () => {
  test("the terminal surface class has a real rule", () => {
    expect(TERM_CLASS).toBe("my-term");
    expect(hasClassSelector(TERM_CLASS)).toBe(true);
  });

  test("the FALLBACK snapshot still matches the canonical set", () => {
    // The snapshot is what this guard runs on in a standalone checkout, where nothing else can
    // notice it has gone stale — a token added upstream would simply stop being covered, and a
    // future `.my-term` rule using it would sail through. This is the one moment anyone CAN
    // notice, so it fails here instead. The fix is always the same: add the named token to
    // FALLBACK_FLIPPING (and decide whether `.my-term` must pin it or it joins the residual).
    if (!flippingIsDerived) return; // nothing to compare against
    const snapshot = new Set(FALLBACK_FLIPPING);
    expect({
      missingFromSnapshot: [...FLIPPING].filter((t) => !snapshot.has(t)).sort(),
      goneFromCanonical: FALLBACK_FLIPPING.filter((t) => !FLIPPING.has(t)).sort(),
    }).toEqual({ missingFromSnapshot: [], goneFromCanonical: [] });
  });

  test("the flipping-token set is real and non-trivial", () => {
    expect(FLIPPING.size).toBeGreaterThan(15);
    // the tokens that must NOT flip — the terminal palette itself
    for (const t of ["--my-term-bg", "--my-term-ink", "--my-term-dim"]) expect(FLIPPING.has(t)).toBe(false);
  });

  test("its own surface and ink come from --my-term-*, not from the theme locals", () => {
    const block = termBlock();
    expect(block).toMatch(/background:\s*var\(--my-term-bg\)/);
    expect(block).toMatch(/color:\s*var\(--my-term-ink\)/);
  });

  test("every flipping local it re-points resolves ONLY through --my-term-* tokens", () => {
    const block = stripComments(termBlock());
    const names = repointed();
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) {
      const decl = block.match(new RegExp(`${escapeRegex(name)}\\s*:([^;]+);`));
      expect(decl).not.toBeNull();
      const value = decl?.[1] ?? "";
      const refs = Array.from(value.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]!);
      expect(refs.length).toBeGreaterThan(0);
      expect(refs.filter((r) => !r.startsWith("--my-term-"))).toEqual([]);
    }
  });

  test("NO rule in the terminal set resolves a flipping token that .my-term has not pinned", () => {
    // This is the real guarantee, and it is why the set above is derived: a terminal rule reaching
    // for --my-error (say) would render the app's LIGHT red inside a permanently dark pane. Either
    // the token is re-pointed on .my-term (and so inherits a term-palette value), or the rule must
    // not use it at all.
    const pinned = new Set(repointed());
    const offenders: string[] = [];
    for (const rule of termRules()) {
      for (const m of rule.body.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)) {
        const token = m[1]!;
        if (FLIPPING.has(token) && !pinned.has(token)) offenders.push(`${rule.selector} → ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the documented residual is exactly the status hues + the knob shadow, and nothing uses them", () => {
    // Two groups, deliberately NOT re-pointed, for two different reasons. Both are pinned
    // explicitly rather than left implied, so growing the list is a decision someone has to make.
    //
    //   the status hues — --my-ok/--my-error/--my-info and their softs. The terminal palette names
    //     no general-purpose status green/red/blue: --my-term-add/--my-term-del (tokens 0.5.18) are
    //     diff-semantic and scoped to diff output, not status colours, and there is no blue at all
    //     — so a status value here would still be an invented colour.
    //
    //   --my-shadow-knob (tokens 0.5.16) — a raised-knob shadow, minted for the theme toggle. The
    //     terminal has no knob: no toggle, no switch, no segmented control renders inside .my-term,
    //     and the guard above is what keeps that true. It could not be pinned honestly even if one
    //     did: every re-pointed local must resolve THROUGH --my-term-* (asserted above), the
    //     terminal palette is all colour and names no shadow, and a literal rgba pair here
    //     would be both an invented value and a hex/colour literal the sheet-wide guards forbid.
    //     If a knob ever does land inside the terminal, the guard above goes red first — which is
    //     the outcome this residual is chosen to preserve.
    //
    //   --my-tone-ink (tokens 0.5.17-pending) — label ink on the tone-filled button's status
    //     fills. It exists to ride the status hues, which are themselves residual here for the
    //     same reason: no tone-filled control renders inside .my-term, and the usage guard keeps
    //     that true. Pinning it without pinning the hues under it would be an inconsistent
    //     half-measure.
    const RESIDUAL = [
      "--my-ok", "--my-error", "--my-info", "--my-ok-soft", "--my-error-soft", "--my-info-soft",
      "--my-shadow-knob", "--my-tone-ink",
    ];
    const pinned = new Set(repointed());
    for (const t of RESIDUAL) expect({ t, pinned: pinned.has(t) }).toEqual({ t, pinned: false });
    // and every OTHER flipping token IS pinned
    const residual = new Set(RESIDUAL);
    const unpinned = [...FLIPPING].filter((t) => !pinned.has(t) && !residual.has(t)).sort();
    expect(unpinned).toEqual([]);
  });

  test("the residual is not stale — every token in it is still a flipping token upstream", () => {
    // A residual entry that stops flipping (renamed, or given one value in both themes) would sit
    // here forever as a silent exemption for a token that no longer needs one. Only meaningful
    // when the set is DERIVED from the sibling design repo; the fallback is a frozen snapshot.
    if (!flippingIsDerived) return;
    const RESIDUAL = [
      "--my-ok", "--my-error", "--my-info", "--my-ok-soft", "--my-error-soft", "--my-info-soft",
      "--my-shadow-knob", "--my-tone-ink",
    ];
    expect(RESIDUAL.filter((t) => !FLIPPING.has(t))).toEqual([]);
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
      "my-term__block",
      "my-term__blockpre",
      "my-term__codespan",
      "my-term__copy",
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

describe("rich spans — the codespan + bold treatment", () => {
  test("bold spans get an explicit weight inside the terminal — no reliance on `bolder`", () => {
    expect(css).toMatch(/\.my-term b\s*\{[^}]*font-weight:\s*var\(--my-fw-bold\)/);
  });

  test("the code span is a quiet mono inset that inherits the ROW's color", () => {
    const m = css.match(/\.my-term__codespan\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    const body = m?.[1] ?? "";
    expect(body).toMatch(/font-family:\s*var\(--my-font-mono\)/);
    // the inset fill rides the PINNED surface-hover local (same treatment as .my-term__detail),
    // so it resolves through --my-term-* and stays heritage-dark in both themes
    expect(body).toMatch(/background:\s*var\(--my-surface-hover\)/);
    expect(body).toMatch(/border-radius:/);
    // it declares NO color of its own — the row's kind keeps carrying the hue
    expect(body).not.toMatch(/(?<!-)color\s*:/);
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
