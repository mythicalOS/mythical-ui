// packages/preact-ui/hooks.test.ts — the U7 polling policy's HOOK-LEVEL guard (design note
// §1b-D7, r2-F8, diff r3-F1/r4-F1). The pure scheduling math this hook is built from
// (nextPollDelay/shouldResetEpoch/makePollEpochGuard/runPollTick) now lives in
// `@mythicalos/ui-core` and is unit-tested there (test/logic/poll.test.ts) — those cases are NOT
// re-ported here to avoid duplicate coverage. What's left, and package-specific, is the source
// scan proving THIS package's `usePoll` (a real Preact hook, which can never live in the
// framework-agnostic core) actually routes every response through the imported guard rather than
// re-implementing an unguarded fetch path.
//
// The second describe block below (the concurrent-tick regression) goes further than a source
// scan: this package's bun:test environment has no jsdom/happy-dom, so rather than only proving
// the shape of the code we mount the real `usePoll` with a small hand-rolled DOM/`document` stub
// — just enough surface (a container Preact can diff into, and a `document` with `hidden` +
// visibilitychange listener storage) for Preact to run the hook's actual effects, timers, and
// visibilitychange handler. No fake-timer library is involved (bun:test does not mock timers —
// see https://bun.sh/docs/test/time — only `setSystemTime`, which affects `Date`, not
// `setTimeout`), so cadences run on the real clock with small real delays.

import { describe, expect, test, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, h } from "preact";
import { usePoll } from "./src/index.ts";

// diff r4-F1: the scan must be BINDING — raw-substring checks are decoy-prone: a commented-out
// old `runPollTick(`/`guard,` block satisfies toContain while the live tick bypasses the guard
// (mutate-verified: exactly that mutation passed the unstripped scan). Strip comments (/* */
// blocks + // line tails — string-safe for hooks.ts, which keeps no comment delimiters inside
// string literals) and run EVERY substring/regex assertion against the STRIPPED source, so only
// live code can satisfy a required pattern or trip a banned one.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("usePoll routes every response through the epoch guard (source scan — diff r3-F1, comment-stripped per r4-F1)", () => {
  const src = stripComments(readFileSync(join(import.meta.dir, "src", "hooks.ts"), "utf8"));
  const start = src.indexOf("export function usePoll");
  const end = src.indexOf("export function useInterval");
  const body = src.slice(start, end);

  test("the hook's tick delegates to runPollTick — no un-guarded fetch path remains", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start); // both markers survive stripping — the slice is real code
    expect(body).toContain("runPollTick(");
    expect(body).toContain("guard,");
    expect(body).not.toContain("await fnRef.current()"); // the pre-r3-F1 direct-apply shape
    // r4-F1: the unguarded promise-chain shapes. The live body invokes `fnRef.current()` ONLY as
    // runPollTick's `fetch` seam (`fetch: () => fnRef.current(),` — comma, never chained), so any
    // `.`-chain off the call, and any `.then(setData` apply, is an epoch-guard bypass.
    expect(body).not.toContain("fnRef.current().");
    expect(body).not.toContain(".then(setData");
  });

  test("the render-time epoch reset invalidates the guard FIRST — before the effect cleanup ever runs", () => {
    expect(body).toMatch(/if \(shouldResetEpoch\([^)]*\)\) \{\s*\n\s*guard\.invalidate\(\);/);
  });

  test("effect cleanup invalidates too — unmount/dep-change supersedes the epoch even for legacy (no-epochKey) callers", () => {
    expect(body).toMatch(/return \(\) => \{[\s\S]*?guard\.invalidate\(\);[\s\S]*?\};/);
  });

  test("usePoll/useInterval import the pure scheduling primitives from @mythicalos/ui-core rather than reimplementing them", () => {
    const wholeFile = stripComments(readFileSync(join(import.meta.dir, "src", "hooks.ts"), "utf8"));
    expect(wholeFile).toMatch(/from\s+["']@mythicalos\/ui-core\/logic["']/);
    // none of the pure math's own branchy internals (the ×2 backoff computation) are duplicated here
    expect(wholeFile).not.toContain("2 ** Math.max");
  });
});

// ── concurrent-tick regression: a visibility-return during an in-flight tick must never fork a
// second poll chain (previously: the effect kept one `timer` variable; the visibilitychange
// handler cleared it and fired an immediate tick on return, but if a tick was ALREADY in flight
// no timer was armed to clear, so a second concurrent tick started — each chain's own
// onSettled → schedule() then armed its own timer, overwriting the shared `timer` variable and
// orphaning the other chain, which kept firing forever). ──────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Just enough of a DOM node for Preact to mount/diff a component that renders `null`. */
function makeFakeContainer(): any {
  const el: any = {
    nodeType: 1,
    childNodes: [] as any[],
    appendChild(child: any) {
      el.childNodes.push(child);
      child.parentNode = el;
      return child;
    },
    insertBefore(child: any, ref: any) {
      const idx = ref ? el.childNodes.indexOf(ref) : -1;
      if (idx === -1) el.childNodes.push(child);
      else el.childNodes.splice(idx, 0, child);
      child.parentNode = el;
      return child;
    },
    removeChild(child: any) {
      const idx = el.childNodes.indexOf(child);
      if (idx !== -1) el.childNodes.splice(idx, 1);
      child.parentNode = null;
    },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    contains() {
      return false;
    },
  };
  return el;
}

/** A `document` stub with just `hidden` + visibilitychange listener storage — what usePoll reads. */
function makeFakeDocument() {
  let isHidden = false;
  let handler: (() => void) | undefined;
  return {
    get hidden() {
      return isHidden;
    },
    setHidden(v: boolean) {
      isHidden = v;
    },
    addEventListener(type: string, cb: () => void) {
      if (type === "visibilitychange") handler = cb;
    },
    removeEventListener(type: string, cb: () => void) {
      if (type === "visibilitychange" && handler === cb) handler = undefined;
    },
    /** Simulate the browser firing visibilitychange (on either a hidden→visible or visible→hidden edge). */
    fireVisibilityChange() {
      handler?.();
    },
  };
}

/** Same shape as ui-core/test/logic/poll.test.ts's `deferred()` — a controllable, unsettled fetch. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function mountUsePoll<T>(fn: () => Promise<T>, ms: number) {
  function Probe() {
    usePoll(fn, ms);
    return null;
  }
  const container = makeFakeContainer();
  render(h(Probe, {}), container);
  return { unmount: () => render(null, container) };
}

describe("usePoll — concurrent-tick regression (live-mounted, real timers)", () => {
  let savedDocument: unknown;
  let savedRandom: () => number;

  afterEach(() => {
    (globalThis as { document?: unknown }).document = savedDocument;
    Math.random = savedRandom;
  });

  test("a visibility-return while a tick is in flight does not start a second fetch, and exactly one timer chain continues after it settles", async () => {
    savedDocument = (globalThis as { document?: unknown }).document;
    savedRandom = Math.random;
    Math.random = () => 0.5; // no jitter — nextPollDelay(ms, 0) resolves to exactly `ms`

    const fakeDoc = makeFakeDocument();
    (globalThis as { document?: unknown }).document = fakeDoc;

    const calls: Array<ReturnType<typeof deferred<string>>> = [];
    const fetchStub = () => {
      const d = deferred<string>();
      calls.push(d);
      return d.promise;
    };

    const ms = 40;
    const { unmount } = mountUsePoll(fetchStub, ms);

    await sleep(90); // mount's effect (deferred to Preact's after-paint flush) fires the first tick
    expect(calls.length).toBe(1); // in flight — its deferred is still unresolved

    // Visibility returns while that tick is still in flight — no timer is armed to clear, which
    // is exactly the window the bug lived in.
    fakeDoc.fireVisibilityChange();
    await sleep(15);
    expect(calls.length).toBe(1); // must NOT have started a second, concurrent fetch

    // Settle the in-flight tick: its own onSettled → schedule() continues the single chain.
    calls[0]!.resolve("first");
    await sleep(ms + 25);
    expect(calls.length).toBe(2); // exactly one new tick, on the single chain's own cadence

    calls[1]!.resolve("second");
    await sleep(ms + 25);
    expect(calls.length).toBe(3); // the chain keeps going once, not twice or more

    unmount();
  });

  test("visibility-return while idle (no tick in flight) still refreshes immediately — existing behavior preserved", async () => {
    savedDocument = (globalThis as { document?: unknown }).document;
    savedRandom = Math.random;
    Math.random = () => 0.5;

    const fakeDoc = makeFakeDocument();
    (globalThis as { document?: unknown }).document = fakeDoc;

    let calls = 0;
    const fetchStub = () => {
      calls += 1;
      return Promise.resolve("v"); // settles immediately — idle (timer armed) well before ms elapses
    };

    const ms = 300; // long cadence so the refresh-on-visibility is unambiguously the immediate path
    const { unmount } = mountUsePoll(fetchStub, ms);

    await sleep(90); // initial tick fires and settles, schedule() arms the ms timer
    expect(calls).toBe(1);

    fakeDoc.fireVisibilityChange();
    await sleep(20); // far short of `ms` — only the immediate refresh, not the armed timer, could fire
    expect(calls).toBe(2);

    unmount();
  });
});
