// test/logic/poll.test.ts — ported from mythical-skuld's packages/preact-ui/hooks.test.ts, repointed
// to import from the new ui-core logic module. The U7 polling policy math + fire-time epoch guard
// are pure/DOM-free; the source file's final describe block ("usePoll routes every response through
// the epoch guard" — a source scan of hooks.ts's `usePoll`) is NOT ported here since `usePoll` itself
// is a Preact hook that stays in the Preact binding package, out of this package's scope.

import { describe, expect, test } from "bun:test";
import {
  makePollEpochGuard,
  nextPollDelay,
  POLL_BACKOFF_CAP_MS,
  POLL_JITTER_RATIO,
  runPollTick,
  shouldResetEpoch,
} from "../../src/logic/poll.ts";

const noJitter = () => 0.5; // jitter factor 1.0
const minJitter = () => 0; // the −20% edge
const maxJitter = () => 1; // the +20% edge

describe("nextPollDelay — the U7 policy (±20% jitter, ×2 backoff capped 60 s)", () => {
  test("healthy cadence: the base interval, ±20% jittered", () => {
    expect(nextPollDelay(5000, 0, noJitter)).toBe(5000);
    expect(nextPollDelay(5000, 0, minJitter)).toBe(4000);
    expect(nextPollDelay(5000, 0, maxJitter)).toBe(6000);
  });

  test("exponential ×2 per consecutive failure", () => {
    expect(nextPollDelay(5000, 1, noJitter)).toBe(10000);
    expect(nextPollDelay(5000, 2, noJitter)).toBe(20000);
    expect(nextPollDelay(5000, 3, noJitter)).toBe(40000);
  });

  test("the backoff ladder caps at 60 s (jitter still applies to the capped value)", () => {
    expect(nextPollDelay(5000, 4, noJitter)).toBe(POLL_BACKOFF_CAP_MS); // 80 s uncapped → 60 s
    expect(nextPollDelay(5000, 20, noJitter)).toBe(POLL_BACKOFF_CAP_MS); // deep ladder stays capped (no overflow)
    expect(nextPollDelay(5000, 20, minJitter)).toBe(POLL_BACKOFF_CAP_MS * (1 - POLL_JITTER_RATIO));
    expect(nextPollDelay(5000, 20, maxJitter)).toBe(POLL_BACKOFF_CAP_MS * (1 + POLL_JITTER_RATIO));
  });

  test("success resets the ladder: failures=0 is the healthy cadence again", () => {
    // the CALLER zeroes its failure count on success; delay(base, 0) == the healthy case
    expect(nextPollDelay(30000, 0, noJitter)).toBe(30000);
  });

  test("real random stays inside the ±20% envelope", () => {
    for (let i = 0; i < 200; i++) {
      const d = nextPollDelay(10000, 0);
      expect(d).toBeGreaterThanOrEqual(8000);
      expect(d).toBeLessThanOrEqual(12000);
    }
  });

  test("a negative failure count is treated as healthy (defensive)", () => {
    expect(nextPollDelay(5000, -3, noJitter)).toBe(5000);
  });
});

describe("shouldResetEpoch — the epoch-guard predicate (pure)", () => {
  test("no epoch opt-in never resets", () => {
    expect(shouldResetEpoch(false, { key: "a", enabled: true }, "b", true)).toBe(false);
  });
  test("a key change resets; an enable false→true transition resets", () => {
    expect(shouldResetEpoch(true, { key: "a", enabled: true }, "b", true)).toBe(true);
    expect(shouldResetEpoch(true, { key: "a", enabled: false }, "a", true)).toBe(true);
    expect(shouldResetEpoch(true, { key: "a", enabled: true }, "a", true)).toBe(false);
  });
  test("undefined keys are epochs too (diff r2-F1: deselect ⇄ select transitions both reset)", () => {
    // entity ids arrive as `openJob?.id`-style keys — undefined while nothing is selected
    expect(shouldResetEpoch(true, { key: undefined, enabled: true }, "job-b", true)).toBe(true);
    expect(shouldResetEpoch(true, { key: "job-a", enabled: true }, undefined, true)).toBe(true);
    expect(shouldResetEpoch(true, { key: undefined, enabled: false }, undefined, false)).toBe(false);
  });
});

// ── diff r3-F1: fire-time epoch stamping ─────────────────────────────────────
// The render-time epoch reset clears retained data, but Preact runs effect CLEANUP after paint —
// so a response for entity A resolving between B's render and A's cleanup still saw `alive === true`
// and setData(A) landed under B (surviving if B's read then failed). The fix mirrors the
// ui/vm/selection.ts monotonic-token pattern: every request is stamped with the epoch token at
// FIRE time and its response applies ONLY while that token is still the live epoch — `alive`
// alone is insufficient. The apply decision lives in the pure `runPollTick` + `makePollEpochGuard`
// (DOM-free, deterministically ordered here).

describe("makePollEpochGuard — the monotonic request epoch (diff r3-F1)", () => {
  test("a token stamped in the live epoch applies; invalidate() opens a new epoch and it no longer does", () => {
    const guard = makePollEpochGuard();
    const token = guard.current();
    expect(guard.applies(token)).toBe(true);
    guard.invalidate();
    expect(guard.applies(token)).toBe(false);
    expect(guard.applies(guard.current())).toBe(true);
  });

  test("epochs are monotonic — a twice-superseded token never applies again (re-selecting the same entity still drops older responses)", () => {
    const guard = makePollEpochGuard();
    const t0 = guard.current();
    guard.invalidate(); // A → B
    const t1 = guard.current();
    guard.invalidate(); // B → A again — the epoch, never the id, is freshness (per selection.ts r2-F2)
    expect(guard.applies(t0)).toBe(false);
    expect(guard.applies(t1)).toBe(false);
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runPollTick — stale responses are dropped by fire-time epoch, not `alive` (diff r3-F1)", () => {
  test("THE r3-F1 WINDOW: the old epoch's response resolves BEFORE cleanup runs (alive still true) → dropped, and it must not settle the new epoch's loading", async () => {
    const guard = makePollEpochGuard();
    const read = deferred<string>();
    const applied: string[] = [];
    const settled: boolean[] = [];
    const tick = runPollTick({
      fetch: () => read.promise,
      guard,
      isAlive: () => true, // effect cleanup has NOT run yet — exactly the window `alive` cannot cover
      isHidden: () => false,
      onSuccess: (v) => applied.push(v),
      onFailure: (m) => applied.push(`err:${m}`),
      onSettled: (a) => settled.push(a),
    });
    guard.invalidate(); // the render-time epoch reset: entity A → entity B
    read.resolve("entity-A rows"); // A's in-flight response lands inside the window
    await tick;
    expect(applied).toEqual([]); // dropped — under the old `alive`-only guard this repopulated B with A's data
    expect(settled).toEqual([false]); // stale settle must not clear the NEW epoch's loading state
  });

  test("old response resolves after the switch, then the NEW epoch's read FAILS → error applies over EMPTY data (A never lands, so it cannot survive B's failure)", async () => {
    const guard = makePollEpochGuard();
    const data: string[] = [];
    const errors: string[] = [];
    const readA = deferred<string>();
    const tickA = runPollTick({
      fetch: () => readA.promise,
      guard,
      isAlive: () => true,
      isHidden: () => false,
      onSuccess: (v) => data.push(v),
      onFailure: (m) => errors.push(m),
      onSettled: () => {},
    });
    guard.invalidate(); // switch A → B; B's effect fires its own tick in the new epoch
    const readB = deferred<string>();
    const tickB = runPollTick({
      fetch: () => readB.promise,
      guard,
      isAlive: () => true,
      isHidden: () => false,
      onSuccess: (v) => data.push(v),
      onFailure: (m) => errors.push(m),
      onSettled: () => {},
    });
    readA.resolve("entity-A rows"); // stale — must be dropped
    await tickA;
    readB.reject(new Error("B read failed")); // the new epoch's read fails
    await tickB;
    expect(data).toEqual([]); // A's rows never rendered under B
    expect(errors).toEqual(["B read failed"]); // B's failure surfaces over an empty pane
  });

  test("a same-epoch response applies: success routes to onSuccess and settles applied", async () => {
    const guard = makePollEpochGuard();
    const applied: string[] = [];
    const settled: boolean[] = [];
    await runPollTick({
      fetch: () => Promise.resolve("rows"),
      guard,
      isAlive: () => true,
      isHidden: () => false,
      onSuccess: (v) => applied.push(v),
      onFailure: (m) => applied.push(`err:${m}`),
      onSettled: (a) => settled.push(a),
    });
    expect(applied).toEqual(["rows"]);
    expect(settled).toEqual([true]);
  });

  test("a same-epoch rejection applies as a failure (Error message extracted)", async () => {
    const guard = makePollEpochGuard();
    const failures: string[] = [];
    const settled: boolean[] = [];
    await runPollTick({
      fetch: () => Promise.reject(new Error("boom")),
      guard,
      isAlive: () => true,
      isHidden: () => false,
      onSuccess: () => failures.push("SUCCESS?"),
      onFailure: (m) => failures.push(m),
      onSettled: (a) => settled.push(a),
    });
    expect(failures).toEqual(["boom"]);
    expect(settled).toEqual([true]);
  });

  test("a stale REJECTION is dropped too — a superseded epoch's failure never paints the new epoch's error strip", async () => {
    const guard = makePollEpochGuard();
    const read = deferred<string>();
    const seen: string[] = [];
    const tick = runPollTick({
      fetch: () => read.promise,
      guard,
      isAlive: () => true,
      isHidden: () => false,
      onSuccess: (v) => seen.push(v),
      onFailure: (m) => seen.push(`err:${m}`),
      onSettled: () => {},
    });
    guard.invalidate();
    read.reject(new Error("entity-A read failed"));
    await tick;
    expect(seen).toEqual([]);
  });

  test("after unmount (isAlive false) even a same-epoch response is dropped", async () => {
    const guard = makePollEpochGuard();
    const read = deferred<string>();
    let alive = true;
    const seen: string[] = [];
    const settled: boolean[] = [];
    const tick = runPollTick({
      fetch: () => read.promise,
      guard,
      isAlive: () => alive,
      isHidden: () => false,
      onSuccess: (v) => seen.push(v),
      onFailure: (m) => seen.push(`err:${m}`),
      onSettled: (a) => settled.push(a),
    });
    alive = false; // cleanup ran while the read was in flight
    read.resolve("rows");
    await tick;
    expect(seen).toEqual([]);
    expect(settled).toEqual([false]);
  });

  test("hidden documents never fire the read (U7 pause is upstream of stamping)", async () => {
    const guard = makePollEpochGuard();
    let fetched = false;
    const settled: boolean[] = [];
    await runPollTick({
      fetch: () => {
        fetched = true;
        return Promise.resolve("rows");
      },
      guard,
      isAlive: () => true,
      isHidden: () => true,
      onSuccess: () => {},
      onFailure: () => {},
      onSettled: (a) => settled.push(a),
    });
    expect(fetched).toBe(false);
    expect(settled).toEqual([]); // no settle — visibilitychange rearms, per the hook
  });
});
