// test/logic/session-card.test.ts — the pure derivation behind the `session-card` atom (design
// registry spec v1). The product this was extracted from enforces an honesty doctrine in its view
// model; the parts of it that live in the CARD are design, not product logic, so they are pinned
// here rather than left to the bindings:
//
//   INVARIANT 1 — absence is not zero: no reading ⇒ no band, no fill, "—" (never 0/"0%").
//   INVARIANT 2 — unknown is not idle: no activity signal ⇒ the lifecycle claim, or "unknown";
//                 "idle" is returned ONLY when the product actually claims it.
//   INVARIANT 3 — the 75/90 thresholds are product-tunable, not constants in a render path.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ctxBand,
  ctxBarGeom,
  ctxFillPct,
  ctxMeterClass,
  normalizeCtxThresholds,
  ctxNoteText,
  ctxReading,
  ctxValueText,
  sessionAvatarInitial,
  sessionCardClass,
  sessionCardIsStale,
  sessionCardStale,
  sessionSpineLabel,
  sessionSpineNodes,
  sessionSpineSavedText,
  sessionSpineSummary,
  sessionStatus,
  sessionStatusClass,
  sessionStatusText,
  sessionSubline,
  spineNodeClass,
  CTX_BAR_SPAN,
  CTX_BAR_TICK_WIDTH,
  CTX_THRESHOLDS_DEFAULT,
  CTX_UNKNOWN_TEXT,
  SESSION_AVATAR_UNKNOWN,
  SESSION_STATUS_UNKNOWN,
  SPINE_MAX_NODES,
  type CtxBand,
  type CtxThresholds,
  type SessionLifecycle,
  type SessionStatusTone,
} from "../../src/logic/session-card.ts";

// ════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 1 — absence is not zero
// ════════════════════════════════════════════════════════════════════════════════════════

describe("INVARIANT 1 — a session with no context reading belongs to NO health band", () => {
  test.each([undefined, null])("ctxBand(%p) is 'unknown' — neither healthy nor hot", (pct) => {
    expect(ctxBand(pct)).toBe("unknown");
  });

  test("a garbage reading is not a reading (NaN / ±Infinity ⇒ unknown, never 'ok')", () => {
    expect(ctxBand(Number.NaN)).toBe("unknown");
    expect(ctxBand(Number.POSITIVE_INFINITY)).toBe("unknown");
    expect(ctxBand(Number.NEGATIVE_INFINITY)).toBe("unknown");
  });

  test("unknown is NOT the same band as a healthy reading", () => {
    expect(ctxBand(undefined)).not.toBe(ctxBand(0));
    expect(ctxBand(undefined)).not.toBe(ctxBand(12));
    expect(ctxBand(0)).toBe("ok");
  });

  test("no reading ⇒ no fill length at all — the caller cannot substitute 0", () => {
    expect(ctxFillPct(undefined)).toBeUndefined();
    expect(ctxFillPct(null)).toBeUndefined();
    expect(ctxFillPct(Number.NaN)).toBeUndefined();
    // a REPORTED zero is a real reading and stays a number
    expect(ctxFillPct(0)).toBe(0);
  });

  test("no reading ⇒ the meter's value is an em-dash, NEVER '0%'", () => {
    expect(ctxValueText(undefined)).toBe(CTX_UNKNOWN_TEXT);
    expect(ctxValueText(null)).toBe(CTX_UNKNOWN_TEXT);
    expect(ctxValueText(undefined)).not.toBe("0%");
    // a reported zero still renders as a confident zero
    expect(ctxValueText(0)).toBe("0%");
  });

  test("ctxBarGeom emits NO fill for an absent reading (a 0-width rect would read as 0%)", () => {
    expect(ctxBarGeom(undefined).fill).toBeUndefined();
    expect(ctxBarGeom(0).fill).toBe(0);
  });

  test("the unknown note says so outright and outranks 'stale' (stale implies a last-known value)", () => {
    expect(ctxNoteText("unknown")).toBe("context · not measured");
    expect(ctxNoteText("unknown", { stale: true })).toBe("context · not measured");
    expect(ctxNoteText("ok", { stale: true })).toBe("context · stale");
  });

  test("the unknown meter carries its own class — visually distinct from every band", () => {
    expect(ctxMeterClass({ band: "unknown" })).toBe("my-session-card__ctx my-session-card__ctx--unknown");
    expect(ctxMeterClass({ band: "ok" })).not.toBe(ctxMeterClass({ band: "unknown" }));
    expect(ctxMeterClass({ band: "ok", stale: true })).toBe("my-session-card__ctx my-session-card__ctx--ok is-stale");
  });
});

describe("INVARIANT 1 — the spine strip never fabricates a zero either", () => {
  test("an unreported distill count ⇒ NO nodes and NO strip", () => {
    expect(sessionSpineNodes(undefined)).toEqual([]);
    expect(sessionSpineSummary(undefined)).toBeUndefined();
    expect(sessionSpineSummary({})).toBeUndefined();
    expect(sessionSpineSummary({ savedTok: 41_200 })).toBeUndefined();
  });

  test("a REPORTED zero is a real reading — the tip alone, labelled 0", () => {
    expect(sessionSpineNodes(0)).toEqual([{ tip: true }]);
    expect(sessionSpineSummary({ distills: 0 })?.label).toBe("spine · 0 distills");
  });

  test("an unreported saving renders '—', never '0 tok'", () => {
    expect(sessionSpineSavedText(undefined)).toBe(CTX_UNKNOWN_TEXT);
    expect(sessionSpineSavedText(null)).toBe(CTX_UNKNOWN_TEXT);
    expect(sessionSpineSavedText(Number.NaN)).toBe(CTX_UNKNOWN_TEXT);
    expect(sessionSpineSavedText(0)).toBe("0 tok");
    expect(sessionSpineSummary({ distills: 2 })?.value).toBe(CTX_UNKNOWN_TEXT);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 2 — unknown is not idle
// ════════════════════════════════════════════════════════════════════════════════════════

describe("INVARIANT 2 — 'idle' is a claim; absence of a signal is 'unknown'", () => {
  test("nothing reported at all ⇒ unknown, with its own key AND its own tone", () => {
    const s = sessionStatus();
    expect(s.key).toBe("unknown");
    expect(s.label).toBe("unknown");
    expect(s.tone).toBe("unknown");
    expect(s.pulse).toBe(false);
    expect(sessionStatus({})).toEqual(s);
  });

  test("unknown is NOT collapsed into idle — different key, label and tone", () => {
    const unknown = sessionStatus();
    const idle = sessionStatus({ activity: "idle" });
    expect(idle.key).toBe("idle");
    expect(unknown.key).not.toBe(idle.key);
    expect(unknown.label).not.toBe(idle.label);
    expect(unknown.tone).not.toBe(idle.tone);
    // and the class strings differ, so the two cannot render identically
    expect(sessionStatusClass(unknown)).not.toBe(sessionStatusClass(idle));
  });

  test("ACTIVE BUT NO ACTIVITY SIGNAL ⇒ the honest lifecycle label, never a fabricated idle/working", () => {
    const s = sessionStatus({ lifecycle: "active" });
    expect(s.key).toBe("active");
    expect(s.label).toBe("active");
    expect(s.tone).toBe("ok");
    expect(s.pulse).toBe(false);
    expect(s.label).not.toBe("idle");
    expect(s.label).not.toBe("working");
  });

  test("'idle' is returned ONLY for an explicit activity claim", () => {
    expect(sessionStatus({ activity: "idle" }).key).toBe("idle");
    expect(sessionStatus({ lifecycle: "active", activity: "idle" }).key).toBe("idle");
    // every other input shape that could tempt a collapse
    expect(sessionStatus({ lifecycle: "active" }).key).not.toBe("idle");
    expect(sessionStatus({ lifecycle: "stopped" }).key).not.toBe("idle");
    expect(sessionStatus({ connected: true }).key).not.toBe("idle");
    expect(sessionStatus({ connected: false }).key).not.toBe("idle");
  });

  test("an unreported connection is not a claim of disconnection", () => {
    expect(sessionStatus({ lifecycle: "active" }).key).toBe("active");
    expect(sessionStatus({ lifecycle: "active", connected: true }).key).toBe("active");
  });
});

describe("sessionStatus — precedence", () => {
  test("a down link on a session the product calls active wins over the activity claim", () => {
    const s = sessionStatus({ lifecycle: "active", activity: "working", connected: false });
    expect(s.key).toBe("disconnected");
    expect(s.tone).toBe("muted");
    expect(s.pulse).toBe(true);
    // never the prototype's "reconnecting…" — this atom cannot verify retry machinery
    expect(s.label).toBe("disconnected");
  });

  test("a down link with NO reported lifecycle still reads disconnected (we are not hearing from it)", () => {
    expect(sessionStatus({ connected: false }).key).toBe("disconnected");
  });

  test("a down link does NOT override a lifecycle that already explains it", () => {
    for (const lifecycle of ["spawning", "stopping", "stopped", "failed"] as const) {
      expect(sessionStatus({ lifecycle, connected: false }).key).toBe(lifecycle);
    }
  });

  test("an activity claim about a non-active session loses to the lifecycle (a contradiction)", () => {
    expect(sessionStatus({ lifecycle: "stopped", activity: "working" }).key).toBe("stopped");
    expect(sessionStatus({ lifecycle: "failed", activity: "idle" }).key).toBe("failed");
  });

  test("working: ok tone, pulsing — and it is a claim, so it needs the wire to make it", () => {
    const s = sessionStatus({ lifecycle: "active", activity: "working" });
    expect(s).toEqual({ key: "working", label: "working", tone: "ok", pulse: true });
  });

  test("every lifecycle has an honest label/tone, and only transient states pulse", () => {
    const cases: Record<SessionLifecycle, { label: string; tone: SessionStatusTone; pulse: boolean }> = {
      spawning: { label: "spawning…", tone: "info", pulse: true },
      active: { label: "active", tone: "ok", pulse: false },
      stopping: { label: "stopping…", tone: "warn", pulse: true },
      stopped: { label: "stopped", tone: "muted", pulse: false },
      failed: { label: "failed", tone: "error", pulse: false },
      paused: { label: "paused", tone: "warn", pulse: false },
    };
    for (const [lifecycle, want] of Object.entries(cases) as [SessionLifecycle, (typeof cases)[SessionLifecycle]][]) {
      const s = sessionStatus({ lifecycle });
      expect(s.key).toBe(lifecycle);
      expect(s.label).toBe(want.label);
      expect(s.tone).toBe(want.tone);
      expect(s.pulse).toBe(want.pulse);
    }
  });

  test("sessionStatusClass — tone modifier + the transient-pulse flag", () => {
    expect(sessionStatusClass(sessionStatus({ lifecycle: "active" }))).toBe(
      "my-session-card__status my-session-card__status--ok",
    );
    expect(sessionStatusClass(sessionStatus({ lifecycle: "spawning" }))).toBe(
      "my-session-card__status my-session-card__status--info is-pulse",
    );
    expect(sessionStatusClass(sessionStatus())).toBe(
      "my-session-card__status my-session-card__status--unknown",
    );
  });

  test("stale is exactly 'the link is down' — not merely 'we know nothing'", () => {
    expect(sessionCardIsStale(sessionStatus({ lifecycle: "active", connected: false }))).toBe(true);
    expect(sessionCardIsStale(sessionStatus())).toBe(false);
    expect(sessionCardIsStale(sessionStatus({ lifecycle: "active" }))).toBe(false);
    expect(sessionCardIsStale(sessionStatus({ lifecycle: "stopped" }))).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// INVARIANT 3 — product-tunable thresholds
// ════════════════════════════════════════════════════════════════════════════════════════

describe("INVARIANT 3 — 75/90 are DEFAULTS, not constants baked into the derivation", () => {
  test("the defaults are the design card's fixed ticks", () => {
    expect(CTX_THRESHOLDS_DEFAULT).toEqual({ warn: 75, critical: 90 });
  });

  test("band boundaries with the defaults", () => {
    expect(ctxBand(74)).toBe("ok");
    expect(ctxBand(75)).toBe("warn");
    expect(ctxBand(89)).toBe("warn");
    expect(ctxBand(90)).toBe("error");
    expect(ctxBand(100)).toBe("error");
  });

  test("a product can retune both thresholds and the whole derivation follows", () => {
    const tuned = { warn: 50, critical: 60 };
    expect(ctxBand(49, tuned)).toBe("ok");
    expect(ctxBand(50, tuned)).toBe("warn");
    expect(ctxBand(60, tuned)).toBe("error");
    // …and the same reading lands in a different band under the defaults
    expect(ctxBand(60)).toBe("ok");
  });

  test("the ticks the bar draws come from the SAME thresholds the band uses", () => {
    expect(ctxBarGeom(50).ticks.map((t) => t.pct)).toEqual([75, 90]);
    expect(ctxBarGeom(50, { warn: 40, critical: 80 }).ticks.map((t) => t.pct)).toEqual([40, 80]);
  });

  test("a mis-ordered pair is ORDERED, so neither tick marks an unreachable boundary", () => {
    // {warn: 90, critical: 75} would otherwise make 80 an `error` while a `warn` tick still sat at
    // 90 — a boundary the band can never cross. Both boundaries are kept; only their names swap.
    expect(normalizeCtxThresholds({ warn: 90, critical: 75 })).toEqual({ warn: 75, critical: 90 });
    expect(ctxBand(80, { warn: 90, critical: 75 })).toBe("warn");
    expect(ctxBand(95, { warn: 90, critical: 75 })).toBe("error");
    expect(ctxBarGeom(80, { warn: 90, critical: 75 }).ticks.map((t) => t.pct)).toEqual([75, 90]);
  });

  test("every tick the bar draws is a boundary the band can actually cross", () => {
    for (const t of [
      { warn: 75, critical: 90 },
      { warn: 90, critical: 40 },
      { warn: 60, critical: 60 },
      { warn: Number.NaN, critical: 30 },
    ]) {
      const norm = normalizeCtxThresholds(t);
      expect(norm.warn).toBeLessThanOrEqual(norm.critical);
      for (const tick of ctxBarGeom(0, t).ticks) {
        expect(ctxBand(Math.ceil(tick.pct), t)).not.toBe("ok");
      }
    }
  });

  test("an UNUSABLE threshold falls back to the default in BOTH the band and the ticks", () => {
    // a threshold that is not a finite number strictly inside the rail marks nothing the meter can
    // draw — it must not silently reclassify every reading while drawing no tick to explain it
    for (const broken of [
      { warn: Number.NaN, critical: Number.NaN },
      { warn: -5, critical: 140 },
      { warn: 0, critical: 100 },
      { warn: Number.POSITIVE_INFINITY, critical: Number.NEGATIVE_INFINITY },
    ]) {
      expect(normalizeCtxThresholds(broken)).toEqual(CTX_THRESHOLDS_DEFAULT);
      // the band a broken config yields is the DEFAULT band, never a blanket ok…
      expect(ctxBand(95, broken)).toBe("error");
      expect(ctxBand(80, broken)).toBe("warn");
      expect(ctxBand(10, broken)).toBe("ok");
      // …and the ticks agree with it, rather than vanishing
      expect(ctxBarGeom(50, broken).ticks.map((t) => t.pct)).toEqual([75, 90]);
    }
  });

  test("one broken member falls back alone — the usable one is honored", () => {
    // the NaN warn falls back to 75, the usable critical of 60 is kept — then the pair is ordered
    expect(normalizeCtxThresholds({ warn: Number.NaN, critical: 60 })).toEqual({ warn: 60, critical: 75 });
    expect(ctxBarGeom(0, { warn: Number.NaN, critical: 60 }).ticks.map((t) => t.pct)).toEqual([60, 75]);
  });

  test("the band and the ticks are ALWAYS derived from the same normalized pair", () => {
    for (const t of [
      { warn: 75, critical: 90 },
      { warn: 40, critical: 80 },
      { warn: 0, critical: 55 },
      { warn: Number.NaN, critical: 90 },
      { warn: 99.9, critical: 99.95 },
    ]) {
      const norm = normalizeCtxThresholds(t);
      const ticks = ctxBarGeom(0, t).ticks.map((x) => x.pct);
      expect(new Set(ticks)).toEqual(new Set([norm.warn, norm.critical]));
      expect(ctxBand(Math.ceil(norm.critical), t)).toBe("error");
      expect(ctxBand(Math.ceil(norm.warn), t)).not.toBe("ok");
      expect(norm.warn).toBeLessThanOrEqual(norm.critical);
    }
  });

  test("out-of-range readings are clamped before the band and the fill are derived", () => {
    expect(ctxBand(-10)).toBe("ok");
    expect(ctxBand(150)).toBe("error");
    expect(ctxFillPct(150)).toBe(100);
    expect(ctxFillPct(-10)).toBe(0);
    expect(ctxValueText(150)).toBe("100%");
  });
});

describe("ctxBarGeom — pure SVG geometry (no inline CSS: percent IS the x axis)", () => {
  test("the fill maps 1:1 onto the rail's user space", () => {
    expect(ctxBarGeom(62).fill).toBe(62);
    expect(ctxBarGeom(62).span).toBe(CTX_BAR_SPAN);
  });

  test("ticks are centred on their threshold and kept inside the rail", () => {
    const [warn] = ctxBarGeom(0).ticks;
    expect(warn?.x).toBeCloseTo(75 - CTX_BAR_TICK_WIDTH / 2, 10);
    expect(warn?.width).toBe(CTX_BAR_TICK_WIDTH);
    const [edge] = ctxBarGeom(0, { warn: 99.9, critical: 99.95 }).ticks;
    expect(edge!.x + edge!.width).toBeLessThanOrEqual(CTX_BAR_SPAN);
  });

  test("coincident thresholds collapse to ONE tick, not two stacked ones", () => {
    expect(ctxBarGeom(0, { warn: 90, critical: 90 }).ticks.map((t) => t.pct)).toEqual([90]);
  });

  test("ticks come out ascending regardless of the order they were configured in", () => {
    expect(ctxBarGeom(0, { warn: 90, critical: 40 }).ticks.map((t) => t.pct)).toEqual([40, 90]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// the rest of the card's derivation
// ════════════════════════════════════════════════════════════════════════════════════════

describe("ctxNoteText — the design card's band annotations", () => {
  test.each([
    ["ok", {}, "context"],
    ["warn", {}, "context · distill suggested"],
    ["error", {}, "context · distill now"],
    ["ok", { stale: true }, "context · stale"],
    ["unknown", {}, "context · not measured"],
  ] as const)("band=%s opts=%p", (band, opts, want) => {
    expect(ctxNoteText(band, opts)).toBe(want);
  });
});

describe("sessionCardClass — selected and stale are INDEPENDENT modifiers", () => {
  test("a session can be selected AND disconnected at once", () => {
    expect(sessionCardClass()).toBe("my-session-card");
    expect(sessionCardClass({ selected: true })).toBe("my-session-card is-selected");
    expect(sessionCardClass({ stale: true })).toBe("my-session-card is-stale");
    expect(sessionCardClass({ selected: true, stale: true })).toBe("my-session-card is-selected is-stale");
  });
});

describe("sessionAvatarInitial", () => {
  test("first alphanumeric, uppercased", () => {
    expect(sessionAvatarInitial("Jacob")).toBe("J");
    expect(sessionAvatarInitial("  peter")).toBe("P");
    expect(sessionAvatarInitial("·—· mike")).toBe("M");
    expect(sessionAvatarInitial("42-worker")).toBe("4");
  });
  test("no nameable character ⇒ '?', not a fabricated initial", () => {
    expect(sessionAvatarInitial("")).toBe(SESSION_AVATAR_UNKNOWN);
    expect(sessionAvatarInitial("   ")).toBe(SESSION_AVATAR_UNKNOWN);
    expect(sessionAvatarInitial(undefined)).toBe(SESSION_AVATAR_UNKNOWN);
    expect(sessionAvatarInitial(null)).toBe(SESSION_AVATAR_UNKNOWN);
    expect(sessionAvatarInitial("···")).toBe(SESSION_AVATAR_UNKNOWN);
  });
});

describe("sessionSubline — absent parts collapse, never a dangling separator", () => {
  test("the design card's own sublines", () => {
    expect(sessionSubline(["worker", "opus-4-8", "2h 14m"])).toBe("worker · opus-4-8 · 2h 14m");
    expect(sessionSubline(["reviewer", "opus-4-8", "queued: 1 ON-DONE"])).toBe(
      "reviewer · opus-4-8 · queued: 1 ON-DONE",
    );
    expect(sessionSubline(["architect", "last seen 00:12 ago"])).toBe("architect · last seen 00:12 ago");
  });
  test("holes collapse from any position", () => {
    expect(sessionSubline(["worker", undefined, "2h"])).toBe("worker · 2h");
    expect(sessionSubline([undefined, "opus", null])).toBe("opus");
    expect(sessionSubline(["", "  ", "opus"])).toBe("opus");
  });
  test("an all-absent list yields the empty string (the binding then omits the line)", () => {
    expect(sessionSubline([])).toBe("");
    expect(sessionSubline([undefined, null, "   "])).toBe("");
    expect(sessionSubline()).toBe("");
  });
});

describe("spine strip — filled nodes = distills, hollow node = the live tip", () => {
  test("the design card's three spine states", () => {
    expect(sessionSpineNodes(3)).toEqual([{ tip: false }, { tip: false }, { tip: false }, { tip: true }]);
    expect(sessionSpineNodes(1)).toEqual([{ tip: false }, { tip: true }]);
    expect(sessionSpineNodes(2)).toEqual([{ tip: false }, { tip: false }, { tip: true }]);
  });
  test("exactly one tip, always last", () => {
    for (const n of [0, 1, 5]) {
      const nodes = sessionSpineNodes(n);
      expect(nodes.filter((x) => x.tip)).toHaveLength(1);
      expect(nodes[nodes.length - 1]!.tip).toBe(true);
    }
  });
  test("a non-integer / negative count degrades to a sane node count", () => {
    expect(sessionSpineNodes(2.7)).toHaveLength(3);
    expect(sessionSpineNodes(-4)).toEqual([{ tip: true }]);
  });
  test("spineNodeClass distinguishes the tip", () => {
    expect(spineNodeClass({ tip: false })).toBe("my-session-card__spine-node");
    expect(spineNodeClass({ tip: true })).toBe(
      "my-session-card__spine-node my-session-card__spine-node--tip",
    );
  });
  test("label pluralizes", () => {
    expect(sessionSpineLabel(1)).toBe("spine · 1 distill");
    expect(sessionSpineLabel(3)).toBe("spine · 3 distills");
    expect(sessionSpineLabel(0)).toBe("spine · 0 distills");
  });
  test("saved-token text: a saving is a reduction (real U+2212 minus), growth is stated as growth", () => {
    expect(sessionSpineSavedText(41_200)).toBe("−41.2k tok");
    expect(sessionSpineSavedText(12_800)).toBe("−12.8k tok");
    expect(sessionSpineSavedText(412)).toBe("−412 tok");
    expect(sessionSpineSavedText(2_400_000)).toBe("−2.4M tok");
    expect(sessionSpineSavedText(-1_500)).toBe("+1.5k tok");
  });
  test("the whole summary, matching the design card's default state", () => {
    expect(sessionSpineSummary({ distills: 3, savedTok: 41_200 })).toEqual({
      nodes: [{ tip: false }, { tip: false }, { tip: false }, { tip: true }],
      label: "spine · 3 distills",
      value: "−41.2k tok",
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// stylesheet — this component's share of test/css.test.ts's guards, scoped to the new block
// ════════════════════════════════════════════════════════════════════════════════════════
//
// css.test.ts resolves the canonical tokens.css relative to a MAIN CHECKOUT of this repo, so it
// cannot run from a git worktree. These two guards are the same checks — (c) every referenced
// token exists, and (e) every class the logic emits has a real selector — scoped to the
// session-card block, with a tokens path that resolves from either layout.

const stylesPath = join(import.meta.dir, "..", "..", "styles.css");
const styles = readFileSync(stylesPath, "utf8");
const SESSION_CARD_MARKER = "/* ── session-card (design registry";

/** The canonical tokens.css: a sibling of this repo's checkout, whether that checkout is the
 *  repo root itself or a worktree one level deeper under `.worktrees/<name>/`. */
function canonicalTokensPath(): string {
  const up = [
    join(import.meta.dir, "..", "..", "..", "..", "..", "mythical-design", "tokens.css"),
    join(import.meta.dir, "..", "..", "..", "..", "..", "..", "mythical-design", "tokens.css"),
  ];
  const hit = up.find((p) => existsSync(p));
  if (hit === undefined) throw new Error(`canonical tokens.css not found; tried:\n${up.join("\n")}`);
  return hit;
}

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function sessionCardSlice(): string {
  const idx = styles.indexOf(SESSION_CARD_MARKER);
  if (idx === -1) throw new Error(`session-card block not found in styles.css (marker: ${SESSION_CARD_MARKER})`);
  return styles.slice(idx);
}

function hasSelector(className: string): boolean {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\.${escaped}(?![\\w-])`).test(styles);
}

describe("styles.css — the session-card block obeys the sheet's own rules", () => {
  const block = sessionCardSlice();

  test("the block is present and non-trivial (the scan itself is meaningful)", () => {
    expect(block.length).toBeGreaterThan(500);
  });

  test("every var(--my-*) it references exists in the canonical tokens.css", () => {
    const tokens = stripComments(readFileSync(canonicalTokensPath(), "utf8"));
    const defined = new Set(Array.from(tokens.matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]));
    expect(defined.size).toBeGreaterThan(20);
    const referenced = new Set(Array.from(block.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]));
    expect(referenced.size).toBeGreaterThan(10);
    expect(Array.from(referenced).filter((n) => !defined.has(n)).sort()).toEqual([]);
  });

  test("zero hard-coded hex colors and zero raw px font-sizes", () => {
    expect(stripComments(block).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(block.match(/font-size:\s*[\d.]+px/g) ?? []).toEqual([]);
  });
});

describe("styles.css — every class the session-card logic emits exists as a selector", () => {
  function expectSelectorsFor(classString: string) {
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      expect({ class: token, found: hasSelector(token) }).toEqual({ class: token, found: true });
    }
  }

  test("sessionCardClass — every selected × stale combination", () => {
    for (const selected of [false, true]) {
      for (const stale of [false, true]) expectSelectorsFor(sessionCardClass({ selected, stale }));
    }
  });

  test("sessionStatusClass — every tone the derivation can produce, pulsing and not", () => {
    const tones: SessionStatusTone[] = ["ok", "warn", "error", "info", "muted", "unknown"];
    for (const tone of tones) {
      for (const pulse of [false, true]) {
        expectSelectorsFor(sessionStatusClass({ key: "unknown", label: "x", tone, pulse }));
      }
    }
    // and the tones are really reachable from real inputs, not just typeable
    const reached = new Set(
      [
        sessionStatus(),
        sessionStatus({ lifecycle: "active" }),
        sessionStatus({ lifecycle: "spawning" }),
        sessionStatus({ lifecycle: "stopping" }),
        sessionStatus({ lifecycle: "failed" }),
        sessionStatus({ activity: "idle" }),
      ].map((s) => s.tone),
    );
    expect(reached).toEqual(new Set(["unknown", "ok", "info", "warn", "error", "muted"]));
  });

  test("ctxMeterClass — every band × stale combination", () => {
    const bands: CtxBand[] = ["unknown", "ok", "warn", "error"];
    for (const band of bands) {
      for (const stale of [false, true]) expectSelectorsFor(ctxMeterClass({ band, stale }));
    }
  });

  test("spineNodeClass — distill node and live tip", () => {
    expectSelectorsFor(spineNodeClass({ tip: false }));
    expectSelectorsFor(spineNodeClass({ tip: true }));
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// what the card SHOWS and what it CLAIMS are the same number
// ════════════════════════════════════════════════════════════════════════════════════════

describe("ctxReading — one canonical presented value drives band, fill and label", () => {
  test("a fractional reading cannot display one percent while being banded as another", () => {
    // 89.5 displays as 90%, so it must BE the ≥90 band — not amber "distill suggested"
    expect(ctxValueText(89.5)).toBe("90%");
    expect(ctxBand(89.5)).toBe("error");
    expect(ctxNoteText(ctxBand(89.5))).toBe("context · distill now");
    // 74.5 displays as 75%, so it must be the warn band
    expect(ctxValueText(74.5)).toBe("75%");
    expect(ctxBand(74.5)).toBe("warn");
    // and just below the rounding boundary nothing moves
    expect(ctxValueText(89.4)).toBe("89%");
    expect(ctxBand(89.4)).toBe("warn");
  });

  test("the fill length is the same presented number as the label, across the range", () => {
    for (const pct of [0, 12.4, 47.6, 62, 74.5, 89.5, 94.2, 100, 150, -3]) {
      const shown = ctxValueText(pct);
      expect(`${ctxFillPct(pct)}%`).toBe(shown);
      expect(`${ctxBarGeom(pct).fill}%`).toBe(shown);
    }
  });

  test("absence still short-circuits everything (invariant 1 is not weakened by rounding)", () => {
    expect(ctxReading(undefined)).toBeUndefined();
    expect(ctxReading(null)).toBeUndefined();
    expect(ctxReading(Number.NaN)).toBeUndefined();
    expect(ctxReading(0)).toBe(0);
  });
});

describe("sessionCardStale — a product may ADD staleness, never remove it", () => {
  test("a down link is stale no matter what the product claims", () => {
    const down = sessionStatus({ lifecycle: "active", connected: false });
    expect(sessionCardStale(down)).toBe(true);
    expect(sessionCardStale(down, true)).toBe(true);
    // the lie this guards: painting a disconnected session as a live, solid-bordered card
    expect(sessionCardStale(down, false)).toBe(true);
  });

  test("a live session is stale only if the product says so", () => {
    const live = sessionStatus({ lifecycle: "active" });
    expect(sessionCardStale(live)).toBe(false);
    expect(sessionCardStale(live, false)).toBe(false);
    expect(sessionCardStale(live, true)).toBe(true);
  });
});

describe("sessionStatusText — an override may reword, never blank out", () => {
  test("a real override wins", () => {
    const down = sessionStatus({ lifecycle: "active", connected: false });
    expect(sessionStatusText(down, "wake unavailable")).toBe("wake unavailable");
  });
  test("an absent or blank override falls back to the derived label (never colour alone)", () => {
    const s = sessionStatus({ lifecycle: "spawning" });
    expect(sessionStatusText(s)).toBe(s.label);
    expect(sessionStatusText(s, undefined)).toBe(s.label);
    expect(sessionStatusText(s, null)).toBe(s.label);
    expect(sessionStatusText(s, "")).toBe(s.label);
    expect(sessionStatusText(s, "   ")).toBe(s.label);
  });
});

describe("hostile / runtime-shaped config cannot crash a render or bend an invariant", () => {
  test("a non-object thresholds value falls back to the defaults instead of throwing", () => {
    for (const bad of [null, undefined]) {
      expect(normalizeCtxThresholds(bad)).toEqual(CTX_THRESHOLDS_DEFAULT);
      expect(ctxBand(95, bad)).toBe("error");
      expect(ctxBarGeom(95, bad).ticks.map((t) => t.pct)).toEqual([75, 90]);
    }
    // a product's settings blob can hand us anything at runtime, TS types notwithstanding
    for (const bad of [0, "75/90", [], true] as unknown as (CtxThresholds | null)[]) {
      expect(normalizeCtxThresholds(bad)).toEqual(CTX_THRESHOLDS_DEFAULT);
      expect(ctxBand(95, bad)).toBe("error");
    }
    expect(normalizeCtxThresholds({ warn: "80" } as unknown as CtxThresholds)).toEqual(CTX_THRESHOLDS_DEFAULT);
  });

  test("the other optional-argument entry points survive null too", () => {
    expect(ctxNoteText("ok", null)).toBe("context");
    expect(ctxMeterClass(null)).toBe(ctxMeterClass({ band: "unknown" }));
    expect(sessionCardClass(null)).toBe("my-session-card");
    expect(sessionStatus(null)).toEqual(sessionStatus());
    expect(sessionSubline(null)).toBe("");
    expect(sessionSubline("worker" as unknown as string[])).toBe("");
  });

  test("INVARIANT 2: a statusLabel override cannot launder an absent signal into a claim", () => {
    const unknown = sessionStatus();
    for (const laundering of ["idle", "working", "active", "healthy"]) {
      expect(sessionStatusText(unknown, laundering)).toBe(unknown.label);
      expect(sessionStatusText(unknown, laundering)).toBe("unknown");
    }
    // …while a status the product DID claim can still be reworded
    const down = sessionStatus({ lifecycle: "active", connected: false });
    expect(sessionStatusText(down, "wake unavailable")).toBe("wake unavailable");
  });
});

describe("spine strip — the node list is bounded", () => {
  test("a runaway count cannot build an unbounded node list", () => {
    expect(sessionSpineNodes(1_000_000)).toHaveLength(SPINE_MAX_NODES);
    expect(sessionSpineNodes(Number.MAX_SAFE_INTEGER)).toHaveLength(SPINE_MAX_NODES);
    // the cap keeps the tip
    expect(sessionSpineNodes(1_000_000).at(-1)).toEqual({ tip: true });
    expect(sessionSpineSummary({ distills: 1_000_000 })?.nodes).toHaveLength(SPINE_MAX_NODES);
  });

  test("the LABEL still states the true count — the strip is a bounded illustration", () => {
    expect(sessionSpineSummary({ distills: 1_000_000 })?.label).toBe("spine · 1000000 distills");
  });

  test("counts at or below the cap are drawn exactly", () => {
    expect(sessionSpineNodes(SPINE_MAX_NODES - 1)).toHaveLength(SPINE_MAX_NODES);
    expect(sessionSpineNodes(SPINE_MAX_NODES - 2)).toHaveLength(SPINE_MAX_NODES - 1);
  });
});

describe("sessionCardClass — the WHOLE root class attribute is derived in core", () => {
  test("a product's extra classes are appended, with no stray whitespace either way", () => {
    expect(sessionCardClass({ extra: "rail-extra" })).toBe("my-session-card rail-extra");
    expect(sessionCardClass({ selected: true, stale: true, extra: "a b" })).toBe(
      "my-session-card is-selected is-stale a b",
    );
    for (const extra of ["", "   ", undefined, null]) {
      expect(sessionCardClass({ extra })).toBe("my-session-card");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════
// the design card's context escalation (spec states 2 and 3)
// ════════════════════════════════════════════════════════════════════════════════════════

describe("sessionStatus — a hot context speaks over the status line, in the band's hue", () => {
  test("warn ⇒ 'context high'; error ⇒ 'context critical' (spec states 2 and 3)", () => {
    const high = sessionStatus({ lifecycle: "active" }, "warn");
    expect(high).toEqual({ key: "context-high", label: "context high", tone: "warn", pulse: false });
    const critical = sessionStatus({ lifecycle: "active" }, "error");
    expect(critical).toEqual({ key: "context-critical", label: "context critical", tone: "error", pulse: false });
  });

  test("the underlying pulse rides along — a working session that goes hot is still working", () => {
    expect(sessionStatus({ lifecycle: "active", activity: "working" }, "error").pulse).toBe(true);
    expect(sessionStatus({ lifecycle: "active", activity: "idle" }, "error").pulse).toBe(false);
  });

  test("a measurement is a real claim, so it speaks even when the lifecycle was never reported", () => {
    expect(sessionStatus({}, "error").key).toBe("context-critical");
    expect(sessionStatus(undefined, "warn").key).toBe("context-high");
  });

  test("INVARIANT 1: an UNMEASURED context never escalates — unknown is not a band", () => {
    expect(sessionStatus({ lifecycle: "active" }, "unknown").key).toBe("active");
    expect(sessionStatus({ lifecycle: "active" }, undefined).key).toBe("active");
    expect(sessionStatus({ lifecycle: "active" }, null).key).toBe("active");
    expect(sessionStatus({}, "unknown")).toEqual(SESSION_STATUS_UNKNOWN);
  });

  test("a nominal context changes nothing", () => {
    expect(sessionStatus({ lifecycle: "active" }, "ok").key).toBe("active");
    expect(sessionStatus({ activity: "idle" }, "ok").key).toBe("idle");
  });

  test("a down link, and every terminal/transient lifecycle, outrank the context", () => {
    expect(sessionStatus({ lifecycle: "active", connected: false }, "error").key).toBe("disconnected");
    for (const lifecycle of ["spawning", "stopping", "stopped", "failed", "paused"] as const) {
      expect(sessionStatus({ lifecycle }, "error").key).toBe(lifecycle);
    }
  });

  test("the escalated tones are ones the stylesheet already dresses", () => {
    for (const band of ["warn", "error"] as const) {
      const s = sessionStatus({ lifecycle: "active" }, band);
      expect(s.tone).toBe(band);
      expect(sessionStatusClass(s)).toContain(`my-session-card__status--${band}`);
    }
  });
});

describe("sessionStatusText — an override may reword, never borrow another status's word", () => {
  test("INVARIANT 2: 'idle'/'working' cannot be pinned on a session that claimed neither", () => {
    const active = sessionStatus({ lifecycle: "active" });
    for (const laundering of ["idle", "working", "Idle", "  WORKING  "]) {
      expect(sessionStatusText(active, laundering)).toBe("active");
    }
  });

  test("no status can borrow another's reserved word", () => {
    const stopped = sessionStatus({ lifecycle: "stopped" });
    for (const laundering of ["active", "working", "disconnected", "context critical", "unknown"]) {
      expect(sessionStatusText(stopped, laundering)).toBe("stopped");
    }
    expect(sessionStatusText(sessionStatus({ lifecycle: "active" }, "error"), "active")).toBe("context critical");
  });

  test("a status may still be reworded with its OWN word, ellipsis form included", () => {
    expect(sessionStatusText(sessionStatus({ activity: "idle" }), "idle")).toBe("idle");
    expect(sessionStatusText(sessionStatus({ lifecycle: "stopping" }), "stopping...")).toBe("stopping...");
  });

  test("free wording outside the reserved vocabulary still passes", () => {
    const down = sessionStatus({ lifecycle: "active", connected: false });
    expect(sessionStatusText(down, "wake unavailable")).toBe("wake unavailable");
    expect(sessionStatusText(sessionStatus({ lifecycle: "failed" }), "failed (exit 1)")).toBe("failed (exit 1)");
  });
});
