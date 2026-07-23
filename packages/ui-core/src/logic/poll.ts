// @mythicalos/ui-core — the pure, DOM-free U7 polling policy math + fire-time epoch guard. Ported
// verbatim (names + signatures identical) from the family's internal Preact atoms package (hooks.ts).
// The Preact `usePoll`/`useInterval` hook wrappers stay in the Preact binding package — they import
// `preact/hooks`, which this package must never depend on. Everything here is the pure math those
// hooks are built on: per-call interval, ±20% jitter on every delay, exponential ×2 backoff on
// consecutive failures capped at 60 s (reset on success), and the fire-time epoch stamp (diff r3-F1)
// so a stale in-flight response for an old entity can never repaint a newer one's pane.

/** U7 policy constants: every delay is jittered ±20%; the failure-backoff ladder tops out at 60 s. */
export const POLL_JITTER_RATIO = 0.2;
export const POLL_BACKOFF_CAP_MS = 60_000;

/**
 * The U7 scheduling policy, pure + DOM-free: the next poll delay for a base cadence after
 * `consecutiveFailures` failed reads in a row. ×2 per failure (capped at `capMs`), then ±`jitter`
 * uniform jitter so many clients never phase-lock. `random` is injectable for deterministic tests
 * (0.5 ⇒ no jitter; 0 ⇒ the −20% edge; 1 ⇒ the +20% edge). Success resets the caller's failure
 * count to 0, which resets the ladder.
 */
export function nextPollDelay(
  baseMs: number,
  consecutiveFailures: number,
  random: () => number = Math.random,
  opts: { jitterRatio?: number; capMs?: number } = {},
): number {
  const cap = opts.capMs ?? POLL_BACKOFF_CAP_MS;
  const jitterRatio = opts.jitterRatio ?? POLL_JITTER_RATIO;
  const backed = Math.min(baseMs * 2 ** Math.max(0, consecutiveFailures), cap);
  const jitter = 1 + (random() * 2 - 1) * jitterRatio;
  return Math.round(backed * jitter);
}

export interface PollResult<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  /** Force an immediate re-fetch (e.g. a refresh affordance). */
  refresh: () => void;
}

/**
 * diff r3-F1 — a MONOTONIC request-epoch guard, the usePoll analogue of ui/vm/selection.ts:
 * the render-time epoch reset (§L2) clears retained data, but Preact runs effect CLEANUP after
 * paint, so an in-flight response for the OLD entity resolving in that window still saw
 * `alive === true` and repopulated the new entity's pane (surviving if the new read then failed).
 * Every request is stamped with `current()` at FIRE time; its response `applies()` only while
 * that token is still the live epoch. `invalidate()` opens a new epoch — called at the
 * render-time reset (immediately, before any cleanup) and at effect teardown. Pure + DOM-free.
 */
export interface PollEpochGuard {
  /** The token to stamp a request with at fire time. */
  current(): number;
  /** Open a new epoch — every token stamped before this no longer applies. */
  invalidate(): void;
  /** True while `token` is still the live epoch — apply a response ONLY under this. */
  applies(token: number): boolean;
}

export function makePollEpochGuard(): PollEpochGuard {
  let epoch = 0;
  return {
    current: () => epoch,
    invalidate: () => {
      epoch += 1;
    },
    applies: (token) => token === epoch,
  };
}

/** The IO seams `runPollTick` drives — the hook wires these to its state setters/scheduler. */
export interface PollTickIO<T> {
  fetch: () => Promise<T>;
  guard: PollEpochGuard;
  /** False once the owning effect's cleanup ran (unmount/dep change). */
  isAlive: () => boolean;
  /** U7 pause: a hidden document never fires a read. */
  isHidden: () => boolean;
  onSuccess: (value: T) => void;
  onFailure: (message: string) => void;
  /** Runs after every fired read settles; `applied` is false when the response was dropped as stale/dead — a stale settle must not touch the new epoch's loading state. */
  onSettled: (applied: boolean) => void;
}

/**
 * One poll tick with fire-time epoch stamping (diff r3-F1): the epoch token is captured BEFORE
 * the read starts and the response applies only if it still matches when the read settles —
 * `alive` alone cannot cover the render-to-cleanup window. Extracted pure so the stale-orderings
 * are deterministically testable DOM-free; `usePoll` routes every response through here (pinned
 * by a source scan in the Preact binding's tests).
 */
export async function runPollTick<T>(io: PollTickIO<T>): Promise<void> {
  if (!io.isAlive()) return;
  if (io.isHidden()) return; // paused — the visibilitychange handler rearms
  const token = io.guard.current(); // fire-time stamp (r3-F1)
  let applied = false;
  try {
    const v = await io.fetch();
    if (!io.isAlive() || !io.guard.applies(token)) return; // stale/dead — drop
    applied = true;
    io.onSuccess(v);
  } catch (e) {
    if (!io.isAlive() || !io.guard.applies(token)) return; // a superseded failure never paints either
    applied = true;
    io.onFailure(e instanceof Error ? e.message : String(e));
  } finally {
    io.onSettled(applied);
  }
}

/**
 * §L2 — should an epoch-guarded poll RESET (clear retained data+error, restart loading) this render?
 * True only when the caller opted into epoch tracking (`useEpoch`) AND either the `epochKey` changed
 * or `enabled` transitioned false→true — both start a NEW epoch whose first read hasn't settled, so
 * the prior epoch's retained data/error must not render as ready/failed for it. Legacy callers (no
 * `epochKey` option) NEVER reset — the retain-across-toggle/dep-change behavior is unchanged.
 * Pure + DOM-free.
 */
export function shouldResetEpoch(
  useEpoch: boolean,
  prev: { key: unknown; enabled: boolean },
  key: unknown,
  enabled: boolean,
): boolean {
  if (!useEpoch) return false;
  if (prev.key !== key) return true;
  return enabled && !prev.enabled;
}
