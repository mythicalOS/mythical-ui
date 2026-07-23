// @mythicalos/react-ui — small shared hooks (polling + interval). A family UI talks plain
// request/response to its service; pages poll on their cadence via `usePoll`. Extends the U7
// polling policy (design note §1b-D7, r2-F8): per-call interval, ±20% jitter on every delay,
// exponential ×2 backoff on consecutive failures capped at 60 s (reset on success), and
// `document.hidden` pauses the loop with an immediate refresh on visibility return.
//
// React twin of packages/preact-ui/src/hooks.ts. The pure, DOM-free scheduling math
// (`nextPollDelay`, `makePollEpochGuard`, `runPollTick`, `shouldResetEpoch` — the r3-F1 fire-time
// epoch stamp) lives in `@mythicalos/ui-core` and is imported, never reimplemented — identical to
// the Preact sibling. Only the actual React hooks (`usePoll`/`useInterval`, which import `react`
// instead of `preact/hooks`) differ; the hook bodies below are otherwise verbatim.

import { useEffect, useRef, useState } from "react";
import {
  nextPollDelay,
  makePollEpochGuard,
  runPollTick,
  shouldResetEpoch,
  POLL_JITTER_RATIO,
  POLL_BACKOFF_CAP_MS,
  type PollResult,
  type PollEpochGuard,
  type PollTickIO,
} from "@mythicalos/ui-core/logic";

export {
  nextPollDelay,
  makePollEpochGuard,
  runPollTick,
  shouldResetEpoch,
  POLL_JITTER_RATIO,
  POLL_BACKOFF_CAP_MS,
  type PollResult,
  type PollEpochGuard,
  type PollTickIO,
};

/**
 * Poll `fn` on the `ms` cadence while `enabled`, under the U7 policy: every delay ±20% jittered,
 * exponential ×2 backoff on consecutive failures capped at 60 s (reset on success), and
 * `document.hidden` PAUSES the loop (immediate refresh when visibility returns). Fires immediately
 * on mount / when a dep changes, cancels in-flight results after unmount, and never overlaps a
 * slow response with the next tick — ONE scheduler per call site, never parallel duplicate polls.
 * `fn` should resolve (never reject) with the value; thrown errors surface in `error`.
 *
 * Pass an `epochKey` to opt into epoch isolation: a change of key (or an `enabled` false→true
 * transition) clears the retained `data`/`error` and returns to `loading` until the new epoch's
 * first settle. Without `epochKey` the hook retains data/error across toggles and dep changes.
 */
export function usePoll<T>(
  fn: () => Promise<T>,
  ms: number,
  opts: { enabled?: boolean; deps?: readonly unknown[]; epochKey?: unknown } = {},
): PollResult<T> {
  const enabled = opts.enabled ?? true;
  const deps = opts.deps ?? [];
  const useEpoch = "epochKey" in opts;
  const epochKey = opts.epochKey;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // diff r3-F1: one persistent guard per call site — the render-time reset below invalidates it
  // IMMEDIATELY, so an in-flight response for the old epoch is dropped even though the old
  // effect's cleanup (which flips `alive`) only runs after paint.
  const guardRef = useRef<PollEpochGuard | null>(null);
  if (guardRef.current === null) guardRef.current = makePollEpochGuard();
  const guard = guardRef.current;

  const epochRef = useRef<{ key: unknown; enabled: boolean }>({ key: epochKey, enabled });
  if (shouldResetEpoch(useEpoch, epochRef.current, epochKey, enabled)) {
    guard.invalidate(); // FIRST — stale in-flight responses die here, not at deferred cleanup (r3-F1)
    if (data !== undefined) setData(undefined);
    if (error !== undefined) setError(undefined);
    if (enabled && !loading) setLoading(true);
  }
  if (useEpoch) epochRef.current = { key: epochKey, enabled };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let failures = 0; // consecutive failed reads — drives the ×2 backoff ladder (reset on success)
    // true from the moment a tick fires its fetch until that fetch settles — the ONE in-flight
    // read this call site is allowed to have. The visibility handler below must never start a
    // second tick while this is true; it lets the in-flight tick's own onSettled → schedule()
    // continue the single chain instead (a prior version fired an immediate tick on visibility
    // return unconditionally, which could open a second concurrent chain).
    let pending = false;

    const isHidden = () => typeof document !== "undefined" && document.hidden === true;

    const schedule = () => {
      if (!alive || stopped) return;
      // Clear any already-armed timer before arming a new one — defense in depth so a stray
      // double-settle can never leave an earlier timer orphaned (never cleared, still firing).
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      // U7 pause: while the document is hidden no timer is armed — the
      // visibilitychange handler below refreshes immediately on return.
      if (isHidden()) return;
      timer = setTimeout(() => void tick(), nextPollDelay(ms, failures));
    };

    // diff r3-F1: every response routes through runPollTick — stamped with the epoch at fire
    // time, applied only while that epoch is still live. A stale settle leaves loading alone
    // (the reset already set it for the new epoch) but still rearms via schedule()'s own guards.
    const tick = () => {
      pending = true;
      return runPollTick({
        fetch: () => fnRef.current(),
        guard,
        isAlive: () => alive && !stopped,
        isHidden,
        onSuccess: (v) => {
          failures = 0;
          setData(v);
          setError(undefined);
        },
        onFailure: (message) => {
          failures += 1;
          setError(message);
        },
        onSettled: (applied) => {
          if (applied) setLoading(false);
          schedule();
        },
      }).finally(() => {
        pending = false;
      });
    };

    const onVisibility = () => {
      if (!alive || stopped) return;
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      // Immediate refresh on visibility return — but only when idle. A tick already in flight
      // keeps its place as the single chain: its own onSettled → schedule() picks up from here.
      if (!isHidden() && !pending) void tick();
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);

    setLoading(true);
    void tick();
    return () => {
      alive = false;
      stopped = true;
      guard.invalidate(); // r3-F1: teardown supersedes the epoch for legacy (no-epochKey) callers too
      if (timer) clearTimeout(timer);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ms, nonce, epochKey, ...deps]);

  return { data, error, loading, refresh: () => setNonce((n) => n + 1) };
}

/** Run `fn` on a fixed interval while `enabled` (no return value; for fire-and-forget effects). */
export function useInterval(fn: () => void, ms: number, enabled = true): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}
