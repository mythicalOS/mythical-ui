// test/logic/toast.test.ts — ported from BROKKR's internal ui/tests/modal-helpers.test.ts, the
// `composeToastText` describe block (the pure text-join helper's home test — the internal
// Preact atoms package never had a dedicated composeToastText unit test, only this downstream
// consumer did). The doubled-prefix regression case is adapted to inline literals here instead of
// the product-specific `GOOD_NIGHT_TOAST_TITLE`/`GOOD_NIGHT_TOAST_BODY` constants, which belong to
// BROKKR, not this framework-agnostic core.

import { describe, expect, test } from "bun:test";
import { composeToastText, TOAST_SEP } from "../../src/logic/toast.ts";

describe("composeToastText — the toast's visible title/body join", () => {
  test("title only → just the title (no trailing separator)", () => {
    expect(composeToastText("Spawned")).toBe("Spawned");
  });
  test("title + body → joined by the ` — ` separator", () => {
    expect(composeToastText("Delivery failed", "timeout")).toBe("Delivery failed — timeout");
  });
  test("the separator is exactly TOAST_SEP", () => {
    expect(composeToastText("A", "B")).toBe(`A${TOAST_SEP}B`);
  });
  test("a body must not itself repeat the title (the doubled-prefix regression)", () => {
    const title = "Good-night";
    const body = "team stopped.";
    expect(composeToastText(title, body)).toBe("Good-night — team stopped.");
  });
});

// ── The auto-dismiss policy, the collapse view and the stack controller ───────────────────────
// Added with the "errors stay readable" change: the durations used to be one 2600ms cadence for
// every tone, which gave a failure message exactly as long on screen as a success. The policy is
// now graded by severity and an error carries `null` — it stays until the operator closes it.
// It lives HERE, not in a binding, because both bindings (and every product that mounts one)
// must dismiss on the same clock; a literal table in each binding is precisely the drift this
// package exists to make impossible.

import {
  TOAST_DISMISS_MS,
  TOAST_MAX_VISIBLE,
  TOAST_COLLAPSE_LABEL,
  toastDismissMs,
  toastStackView,
  createToastStack,
  type ToastClock,
  type ToastSpec,
  type ToastStatus,
} from "../../src/logic/toast.ts";

const STATUSES: ToastStatus[] = ["ok", "info", "warn", "error"];

describe("the auto-dismiss policy — severity buys reading time; an error never expires", () => {
  test("the table IS the policy: ok 2600 · info 4000 · warn 8000 · error null", () => {
    expect(TOAST_DISMISS_MS).toEqual({ ok: 2600, info: 4000, warn: 8000, error: null });
  });

  test("an error's absence of a deadline is null — never 0, which would dismiss it instantly", () => {
    expect(toastDismissMs("error")).toBeNull();
    expect(toastDismissMs("error")).not.toBe(0);
  });

  test("toastDismissMs answers for every status the type allows (no undefined lookup)", () => {
    for (const status of STATUSES) {
      const ms = toastDismissMs(status);
      expect(ms === null || typeof ms === "number").toBe(true);
      expect(status in TOAST_DISMISS_MS).toBe(true);
    }
  });

  test("the timed ladder never shortens as severity rises", () => {
    const ok = toastDismissMs("ok");
    const info = toastDismissMs("info");
    const warn = toastDismissMs("warn");
    expect(ok).toBeGreaterThan(0);
    expect(info!).toBeGreaterThan(ok!);
    expect(warn!).toBeGreaterThan(info!);
  });
});

describe("toastStackView — the collapse, and the control that makes the hidden ones reachable", () => {
  const n = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

  test("at or under the cap: everything renders and there is NO control to draw", () => {
    for (const count of [0, 1, TOAST_MAX_VISIBLE]) {
      const view = toastStackView(n(count), false);
      expect(view.visible).toEqual(n(count));
      expect(view.hiddenCount).toBe(0);
      expect(view.collapsible).toBe(false);
      expect(view.moreLabel).toBeNull();
      expect(view.expanded).toBe(false);
    }
  });

  test("over the cap, collapsed: the NEWEST cap render, in order, and the rest are counted", () => {
    const view = toastStackView(n(5), false);
    expect(view.visible).toEqual([3, 4, 5]);
    expect(view.hiddenCount).toBe(2);
    expect(view.collapsible).toBe(true);
    expect(view.moreLabel).toBe("+2 more");
  });

  test("over the cap, expanded: every toast renders, nothing is hidden, and the label collapses back", () => {
    const view = toastStackView(n(5), true);
    expect(view.visible).toEqual(n(5));
    expect(view.hiddenCount).toBe(0);
    expect(view.collapsible).toBe(true);
    expect(view.expanded).toBe(true);
    expect(view.moreLabel).toBe(TOAST_COLLAPSE_LABEL);
  });

  test("expanded but under the cap: no control — there is nothing left to collapse", () => {
    const view = toastStackView(n(2), true);
    expect(view.visible).toEqual([1, 2]);
    expect(view.moreLabel).toBeNull();
    expect(view.collapsible).toBe(false);
  });

  test("the hidden count is the real remainder, at any depth", () => {
    expect(toastStackView(n(12), false).hiddenCount).toBe(12 - TOAST_MAX_VISIBLE);
    expect(toastStackView(n(12), false).moreLabel).toBe(`+${12 - TOAST_MAX_VISIBLE} more`);
  });

  test("the input array is never mutated", () => {
    const toasts = n(5);
    toastStackView(toasts, false);
    toastStackView(toasts, true);
    expect(toasts).toEqual([1, 2, 3, 4, 5]);
  });
});

/** A controllable clock: `advance(ms)` moves time AND fires whatever became due, exactly once. */
function fakeClock() {
  let t = 1_000;
  let seq = 1;
  const timers = new Map<number, { fn: () => void; at: number }>();
  const clock: ToastClock = {
    now: () => t,
    setTimer: (fn, ms) => {
      const id = seq++;
      timers.set(id, { fn, at: t + ms });
      return id;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
  };
  return {
    clock,
    armed: () => timers.size,
    advance(ms: number) {
      t += ms;
      for (const [id, entry] of [...timers]) {
        if (entry.at <= t && timers.delete(id)) entry.fn();
      }
    },
  };
}

const spec = (status: ToastStatus, title: string = status): ToastSpec => ({ status, title });

describe("createToastStack — the dismiss clock every binding shares", () => {
  test("a timed toast expires on its own cadence; the error beside it is still there", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    stack.push(spec("error"));
    expect(stack.toasts()).toHaveLength(2);

    advance(2600);
    expect(stack.toasts().map((t) => t.status)).toEqual(["error"]);

    advance(10 * 60 * 1000);
    expect(stack.toasts().map((t) => t.status)).toEqual(["error"]); // no deadline exists to pass
  });

  test("each tone runs its OWN timer — a warn outlives an ok pushed at the same moment", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    stack.push(spec("info"));
    stack.push(spec("warn"));

    advance(2600);
    expect(stack.toasts().map((t) => t.status)).toEqual(["info", "warn"]);
    advance(1400); // 4000 total
    expect(stack.toasts().map((t) => t.status)).toEqual(["warn"]);
    advance(4000); // 8000 total
    expect(stack.toasts()).toEqual([]);
  });

  test("an error is closable — it leaves when, and only when, it is dismissed", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    const id = stack.push(spec("error"));
    advance(60_000);
    expect(stack.toasts()).toHaveLength(1);
    stack.dismiss(id);
    expect(stack.toasts()).toEqual([]);
  });

  test("dismiss disarms the timer — a dismissed id can never fire a second removal", () => {
    const { clock, advance, armed } = fakeClock();
    const stack = createToastStack(clock);
    const id = stack.push(spec("ok"));
    stack.push(spec("ok", "second"));
    expect(armed()).toBe(2);
    stack.dismiss(id);
    expect(armed()).toBe(1);
    advance(2600);
    expect(stack.toasts()).toEqual([]);
  });

  test("held: the remaining time FREEZES — time passing over the old deadline dismisses nothing", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    advance(600);
    expect(stack.remainingMs(1)).toBe(2000);

    stack.setHold("pointer", true);
    expect(stack.isPaused()).toBe(true);
    advance(10_000);
    expect(stack.toasts()).toHaveLength(1);
    expect(stack.remainingMs(1)).toBe(2000);
  });

  test("release re-arms with exactly what was left, not with the full duration", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    advance(600);
    stack.setHold("pointer", true);
    advance(10_000);
    stack.setHold("pointer", false);
    expect(stack.isPaused()).toBe(false);

    advance(1999);
    expect(stack.toasts()).toHaveLength(1); // 1ms of the original 2600 still to run
    advance(1);
    expect(stack.toasts()).toEqual([]);
  });

  test("a hold is idempotent — holding the same reason twice must not restart or forget the remainder", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    advance(600);
    stack.setHold("pointer", true);
    advance(500);
    stack.setHold("pointer", true);
    expect(stack.remainingMs(1)).toBe(2000);
    stack.setHold("pointer", false);
    advance(2000);
    expect(stack.toasts()).toEqual([]);
  });

  test("HOLDS COMBINE: the pointer leaving while the keyboard is still inside does NOT resume", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    advance(600);

    stack.setHold("pointer", true); // the pointer rests on the stack
    stack.setHold("focus", true); // then the operator tabs into the "+n more" button
    stack.setHold("pointer", false); // and the pointer moves away, focus still inside
    expect(stack.isPaused()).toBe(true);

    advance(10_000);
    expect(stack.toasts()).toHaveLength(1); // nothing expired while it was still being read
    expect(stack.remainingMs(1)).toBe(2000);

    stack.setHold("focus", false); // the LAST hold released — now it resumes, with the remainder
    expect(stack.isPaused()).toBe(false);
    advance(1999);
    expect(stack.toasts()).toHaveLength(1);
    advance(1);
    expect(stack.toasts()).toEqual([]);
  });

  test("and the mirror: focus leaving while the pointer still rests on the stack does not resume", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("warn"));
    stack.setHold("focus", true);
    stack.setHold("pointer", true);
    stack.setHold("focus", false);
    expect(stack.isPaused()).toBe(true);
    advance(60_000);
    expect(stack.toasts()).toHaveLength(1);
    stack.setHold("pointer", false);
    advance(8000);
    expect(stack.toasts()).toEqual([]);
  });

  test("KEYBOARD DISMISS: closing the focused toast releases the focus hold, since no blur will", () => {
    // Removing a focused element fires no blur event. Tab to a toast's close button (focus hold),
    // press Enter (the button is removed): without this, the hold would never be released and every
    // toast pushed afterwards would sit on screen for good.
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    const first = stack.push(spec("ok", "the one being closed"));
    stack.push(spec("warn", "its neighbour"));
    stack.setHold("focus", true);
    advance(5000);
    expect(stack.toasts()).toHaveLength(2); // held: nothing expired

    stack.dismiss(first);
    expect(stack.isPaused()).toBe(false);
    advance(8000);
    expect(stack.toasts()).toEqual([]); // the neighbour's own deadline resumed and ran out
  });

  test("…and a toast pushed after that keyboard dismiss counts down like any other", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    const only = stack.push(spec("ok"));
    stack.setHold("focus", true);
    stack.dismiss(only);

    stack.push(spec("ok", "pushed after the dismiss"));
    advance(2600);
    expect(stack.toasts()).toEqual([]);
  });

  test("a dismiss does NOT release the pointer hold — the pointer is still where it was", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    const first = stack.push(spec("ok"));
    stack.push(spec("ok", "second"));
    stack.setHold("pointer", true);
    stack.dismiss(first);
    expect(stack.isPaused()).toBe(true);
    advance(60_000);
    expect(stack.toasts()).toHaveLength(1);
  });

  test("releasing a reason that was never held changes nothing", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    stack.setHold("focus", false);
    expect(stack.isPaused()).toBe(false);
    advance(2600);
    expect(stack.toasts()).toEqual([]);
  });

  test("releasing while already running is a no-op — it never re-arms a second timer", () => {
    const { clock, advance, armed } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    stack.setHold("pointer", false);
    expect(armed()).toBe(1);
    advance(2600);
    expect(stack.toasts()).toEqual([]);
  });

  test("a toast pushed WHILE the stack is held does not start counting down until it is released", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    stack.setHold("pointer", true);
    stack.push(spec("ok"));
    advance(10_000);
    expect(stack.toasts()).toHaveLength(1);
    expect(stack.remainingMs(1)).toBe(2600);

    stack.setHold("pointer", false);
    advance(2599);
    expect(stack.toasts()).toHaveLength(1);
    advance(1);
    expect(stack.toasts()).toEqual([]);
  });

  test("remainingMs: null for a toast with no deadline, undefined for an id the stack never had", () => {
    const { clock } = fakeClock();
    const stack = createToastStack(clock);
    const id = stack.push(spec("error"));
    expect(stack.remainingMs(id)).toBeNull();
    expect(stack.remainingMs(9999)).toBeUndefined();
  });

  test("expanding is reachable and reversible; it auto-collapses once the stack fits again", () => {
    const { clock } = fakeClock();
    const stack = createToastStack(clock);
    const ids = [1, 2, 3, 4, 5].map(() => stack.push(spec("error")));
    expect(stack.view().moreLabel).toBe("+2 more");

    stack.toggleExpanded();
    expect(stack.isExpanded()).toBe(true);
    expect(stack.view().visible).toHaveLength(5);
    expect(stack.view().moreLabel).toBe(TOAST_COLLAPSE_LABEL);

    stack.toggleExpanded();
    expect(stack.isExpanded()).toBe(false);
    expect(stack.view().visible).toHaveLength(TOAST_MAX_VISIBLE);

    stack.toggleExpanded();
    stack.dismiss(ids[0]!);
    stack.dismiss(ids[1]!);
    expect(stack.isExpanded()).toBe(false); // nothing is hidden any more — the state resets itself
    expect(stack.view().moreLabel).toBeNull();
  });

  test("every mutation notifies the subscriber exactly once; unsubscribe and destroy stop it", () => {
    const { clock, advance } = fakeClock();
    const stack = createToastStack(clock);
    let notifications = 0;
    const off = stack.subscribe(() => {
      notifications += 1;
    });

    const id = stack.push(spec("ok"));
    expect(notifications).toBe(1);
    stack.setHold("pointer", true);
    expect(notifications).toBe(2);
    stack.setHold("pointer", true); // no state change ⇒ no repaint
    expect(notifications).toBe(2);
    stack.setHold("focus", true); // a SECOND reason on an already-held stack: no state change either
    expect(notifications).toBe(2);
    stack.setHold("pointer", false); // still held by focus ⇒ still no repaint
    expect(notifications).toBe(2);
    stack.setHold("focus", false);
    expect(notifications).toBe(3);
    stack.toggleExpanded();
    expect(notifications).toBe(4);
    advance(2600); // the timer's own removal repaints too
    expect(notifications).toBe(5);
    expect(stack.remainingMs(id)).toBeUndefined();

    off();
    stack.push(spec("ok"));
    expect(notifications).toBe(5);
  });

  test("destroy disarms every timer and drops every subscriber", () => {
    const { clock, advance, armed } = fakeClock();
    const stack = createToastStack(clock);
    let notifications = 0;
    stack.subscribe(() => {
      notifications += 1;
    });
    stack.push(spec("ok"));
    stack.push(spec("warn"));
    expect(armed()).toBe(2);

    stack.destroy();
    expect(armed()).toBe(0);
    advance(60_000);
    expect(notifications).toBe(2); // the two pushes, and nothing after the teardown
  });

  test("dismissing an id the stack does not hold changes nothing", () => {
    const { clock } = fakeClock();
    const stack = createToastStack(clock);
    stack.push(spec("ok"));
    let notifications = 0;
    stack.subscribe(() => {
      notifications += 1;
    });
    stack.dismiss(4242);
    expect(stack.toasts()).toHaveLength(1);
    expect(notifications).toBe(0);
  });

  test("ids are unique and the toast keeps its spec verbatim", () => {
    const { clock } = fakeClock();
    const stack = createToastStack(clock);
    const action = { label: "Retry", onAction: () => {} };
    const a = stack.push({ status: "error", title: "Save failed", body: "endpoint is required", action });
    const b = stack.push({ status: "ok", title: "Saved" });
    expect(a).not.toBe(b);
    expect(stack.toasts()[0]).toEqual({ id: a, status: "error", title: "Save failed", body: "endpoint is required", action });
    expect(stack.toasts()[1]).toEqual({ id: b, status: "ok", title: "Saved" });
  });
});

describe("createToastStack — the DEFAULT clock is the host's real timers", () => {
  test("no injected clock ⇒ the policy's ms goes straight to setTimeout, and its callback dismisses", () => {
    const realSetTimeout = globalThis.setTimeout;
    const realClearTimeout = globalThis.clearTimeout;
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    let cleared = 0;
    try {
      (globalThis as any).setTimeout = (fn: () => void, ms: number) => {
        scheduled.push({ fn, ms });
        return scheduled.length;
      };
      (globalThis as any).clearTimeout = () => {
        cleared += 1;
      };

      const stack = createToastStack();
      stack.push(spec("warn"));
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0]!.ms).toBe(8000);

      scheduled[0]!.fn();
      expect(stack.toasts()).toEqual([]);

      stack.push(spec("error"));
      expect(scheduled).toHaveLength(1); // an error arms nothing at all
      stack.destroy();
      expect(cleared).toBe(0); // nothing was left armed to clear
    } finally {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    }
  });
});
