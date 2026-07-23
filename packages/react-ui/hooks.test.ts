// packages/react-ui/hooks.test.ts — the U7 polling policy's HOOK-LEVEL guard (design note §1b-D7,
// r2-F8, diff r3-F1/r4-F1). The pure scheduling math this hook is built from
// (nextPollDelay/shouldResetEpoch/makePollEpochGuard/runPollTick) lives in `@mythicalos/ui-core` and
// is unit-tested there (test/logic/poll.test.ts) — those cases are NOT re-ported here to avoid
// duplicate coverage. What's left, and package-specific, is the source scan proving THIS package's
// `usePoll` (a real React hook, which can never live in the framework-agnostic core) actually
// routes every response through the imported guard rather than re-implementing an unguarded fetch
// path.
//
// Ported verbatim (technique-for-technique) from packages/preact-ui/hooks.test.ts. React hooks
// can't be exercised outside a renderer/reconciler, and — same as the Preact sibling — this suite
// doesn't attempt to mount a live polling component; it proves correctness by static source
// analysis of hooks.ts instead. This is the SAME depth the Preact binding achieves (preact-ui has
// no runtime-executed usePoll test either); see the task report's "hook-test depth" section.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
