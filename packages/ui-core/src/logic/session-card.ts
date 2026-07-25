// @mythicalos/ui-core — the pure derivation behind the `session-card` atom (design registry spec
// v1, `mythical-design/ds/components-session-card.html`). Extracted from the only product that
// implemented it (the Control Room's rail `SessionCard.tsx` + its `derive.ts`/`sessionsVm.ts`
// state-dot derivation), with the product's session view-model lifted OUT: every function here
// takes plain primitives, so a second product can render the same card from a different wire shape.
//
// Everything branchy lives here — the Preact and React bindings only render what these functions
// return, so they cannot drift.
//
// THREE HONESTY INVARIANTS ARE LOAD-BEARING (they are design, not product logic):
//
//   1. ABSENCE IS NOT ZERO. A session with no context reading belongs to NO band: `ctxBand`
//      returns `"unknown"`, `ctxFillPct` returns `undefined` (so the binding draws no fill rect at
//      all — never a 0-width one that reads as "0%"), and `ctxValueText` returns `"—"`, never
//      `"0%"`. The same rule governs the spine strip: an unreported `distills` yields ZERO nodes
//      (the strip is omitted), never a fabricated "0 distills"; an unreported `savedTok` renders
//      `"—"`, never `"0 tok"`. A REPORTED zero is a real reading and renders as zero.
//
//   2. UNKNOWN IS NOT IDLE. `idle` is a claim the product's wire has to make. When no activity is
//      reported, `sessionStatus` falls back to the honest LIFECYCLE label (an active session with
//      no activity signal reads `"active"`, not `"idle"`); when nothing at all is reported it
//      returns the distinct `"unknown"` key/tone. `"idle"` is returned ONLY for an explicit
//      `activity: "idle"`.
//
//   3. THE 75/90 THRESHOLDS ARE PRODUCT-TUNABLE (canonical tokens.css rule #4: "thresholds are
//      product-defined (tweakable)"). They are a defaulted parameter — `CTX_THRESHOLDS_DEFAULT` —
//      never a constant baked into a render path.

// ════════════════════════════════════════════════════════════════════════════════════════
// context meter — band, fill, text
// ════════════════════════════════════════════════════════════════════════════════════════

/** Product-tunable context thresholds (percent). Defaults per the design card's fixed ticks. */
export interface CtxThresholds {
  /** ≥ this reading is `warn`. */
  warn: number;
  /** ≥ this reading is `error` ("critical"). */
  critical: number;
}

/** The design card's tick positions: warn at 75%, critical at 90% — overridable per product. */
export const CTX_THRESHOLDS_DEFAULT: CtxThresholds = { warn: 75, critical: 90 };

/** A defensive read for the public entry points below: a parameter default only covers
 *  `undefined`, and a product's runtime-shaped config can hand us `null` or a non-object. */
function isObject<T extends object>(v: T | null | undefined): v is T {
  return typeof v === "object" && v !== null;
}

/**
 * Normalize a product's threshold pair ONCE, so the band and the bar's ticks can never disagree
 * about where the thresholds are. Two corrections:
 *
 *   · A member that is not a finite number strictly inside the rail (0 < t < 100) is not a usable
 *     threshold — it marks nothing the meter can draw — so it falls back to the design default
 *     rather than silently reclassifying every reading. (`{warn: NaN}` must not quietly make every
 *     session look nominal; `{warn: -5}` must not quietly make every session look hot while
 *     drawing no tick to explain why.)
 *   · The pair is ORDERED (`warn` ≤ `critical`). A mis-ordered pair leaves the higher tick
 *     unreachable — with `{warn: 90, critical: 75}` an 80% reading is already `error` while a
 *     `warn` tick still sits at 90, so the bar marks a boundary that can never be crossed. Both
 *     boundaries the product asked for are kept; only which one is named `warn` is corrected.
 */
export function normalizeCtxThresholds(thresholds?: CtxThresholds | null): CtxThresholds {
  // These are PUBLIC entry points a product reaches with runtime-shaped config (a settings blob,
  // an API response), so a non-object gets the defaults rather than a TypeError mid-render — a
  // parameter default only covers `undefined`.
  const t = isObject(thresholds) ? thresholds : CTX_THRESHOLDS_DEFAULT;
  const usable = (v: unknown, fallback: number): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 && v < CTX_BAR_SPAN ? v : fallback;
  const warn = usable(t.warn, CTX_THRESHOLDS_DEFAULT.warn);
  const critical = usable(t.critical, CTX_THRESHOLDS_DEFAULT.critical);
  return { warn: Math.min(warn, critical), critical: Math.max(warn, critical) };
}

/**
 * The context band. `"unknown"` is a FIRST-CLASS member, not a fallback to `"ok"`: a session with
 * no reading (undefined/null/NaN/±Infinity) belongs to no health band — it is neither healthy nor
 * hot (invariant 1).
 */
export type CtxBand = "unknown" | "ok" | "warn" | "error";

/** True only for a usable numeric reading — a garbage reading is not a reading. */
function isReading(pct: number | null | undefined): pct is number {
  return typeof pct === "number" && Number.isFinite(pct);
}

/**
 * The ONE number the card presents: a reading clamped to 0–100 and rounded to the whole percent
 * the card actually shows, or `undefined` when there is no reading. Band, fill and label all
 * derive from this, so the card can never show `90%` while calling it `warn` — what it displays
 * and what it claims are the same number.
 */
export function ctxReading(pct: number | null | undefined): number | undefined {
  return isReading(pct) ? Math.round(Math.min(100, Math.max(0, pct))) : undefined;
}

/**
 * Band for a context reading, derived from the whole percent the card displays. Absent ⇒
 * `"unknown"`. The thresholds are normalized (and ordered) first, so the band and the bar's ticks
 * always agree.
 */
export function ctxBand(pct: number | null | undefined, thresholds?: CtxThresholds | null): CtxBand {
  const v = ctxReading(pct);
  if (v === undefined) return "unknown";
  const t = normalizeCtxThresholds(thresholds);
  if (v >= t.critical) return "error";
  if (v >= t.warn) return "warn";
  return "ok";
}

/**
 * The 0–100 fill length, or `undefined` when there is no reading. `undefined` means the binding
 * draws NO fill at all — the caller must never substitute 0, which would render as a confident
 * "empty context" (invariant 1).
 */
export function ctxFillPct(pct: number | null | undefined): number | undefined {
  return ctxReading(pct);
}

/** What an absent reading renders as — never `"0%"`. */
export const CTX_UNKNOWN_TEXT = "—";

/** The meter's right-hand value: `"62%"` for a reading, `"—"` for none (invariant 1). */
export function ctxValueText(pct: number | null | undefined): string {
  const v = ctxReading(pct);
  return v === undefined ? CTX_UNKNOWN_TEXT : `${v}%`;
}

/** The meter's left-hand label and the separator the card composes its notes with. */
export const CTX_LABEL = "context";
export const SESSION_CARD_SEP = " · ";

/**
 * The meter's left-hand note. The design card annotates the band (`context · distill suggested` at
 * warn, `context · distill now` at error, `context · stale` for a stale reading); the unknown state
 * says so outright, and says it BEFORE `stale` — "stale" implies a last-known value, so it must
 * never stand in for "we never measured it".
 */
export function ctxNoteText(band: CtxBand, opts?: { stale?: boolean } | null): string {
  if (band === "unknown") return `${CTX_LABEL}${SESSION_CARD_SEP}not measured`;
  if (isObject(opts) && opts.stale === true) return `${CTX_LABEL}${SESSION_CARD_SEP}stale`;
  if (band === "error") return `${CTX_LABEL}${SESSION_CARD_SEP}distill now`;
  if (band === "warn") return `${CTX_LABEL}${SESSION_CARD_SEP}distill suggested`;
  return CTX_LABEL;
}

/** Wrapper class for the meter — the band modifier tints the fill AND the value in one place. */
export function ctxMeterClass(input?: { band: CtxBand; stale?: boolean } | null): string {
  const band = isObject(input) ? input.band : "unknown";
  const stale = isObject(input) && input.stale === true;
  return `my-session-card__ctx my-session-card__ctx--${band}${stale ? " is-stale" : ""}`;
}

// ── bar geometry (SVG presentation attributes only — CSP forbids the inline `width:62%` the
//    design prototype used, and product-tunable ticks cannot be expressed as fixed classes) ──

/** The bar's user-space width: percent IS the x axis, so a reading maps 1:1 onto it. */
export const CTX_BAR_SPAN = 100;
/** The bar's user-space height (the design card's 8px rail). */
export const CTX_BAR_HEIGHT = 8;
/** `viewBox` for the bar; the binding stretches it to the card width (`preserveAspectRatio="none"`). */
export const CTX_BAR_VIEWBOX = `0 0 ${CTX_BAR_SPAN} ${CTX_BAR_HEIGHT}`;
/** Tick width in user space (≈1.5px once the bar is stretched to a ~250px card). */
export const CTX_BAR_TICK_WIDTH = 0.6;

export interface CtxBarTick {
  /** The threshold this tick marks. */
  pct: number;
  /** Left edge in user space — centred on `pct`, then kept inside the rail. */
  x: number;
  width: number;
}

export interface CtxBarGeom {
  span: number;
  height: number;
  /** Fill width in user space. `undefined` ⇒ draw no fill rect at all (invariant 1). */
  fill: number | undefined;
  /** In-range, de-duplicated, ascending threshold ticks. */
  ticks: CtxBarTick[];
}

/**
 * Pure bar geometry, from the SAME normalized thresholds `ctxBand` uses — an unusable threshold
 * falls back to the default in both places, so the ticks always mark the boundaries the band is
 * actually enforcing. Duplicates collapse, so `{warn: 90, critical: 90}` draws one tick, not two
 * stacked ones.
 */
export function ctxBarGeom(pct: number | null | undefined, thresholds?: CtxThresholds | null): CtxBarGeom {
  const norm = normalizeCtxThresholds(thresholds);
  const seen = new Set<number>();
  const ticks: CtxBarTick[] = [];
  for (const t of [norm.warn, norm.critical]) {
    if (seen.has(t)) continue;
    seen.add(t);
    const x = Math.min(CTX_BAR_SPAN - CTX_BAR_TICK_WIDTH, Math.max(0, t - CTX_BAR_TICK_WIDTH / 2));
    ticks.push({ pct: t, x, width: CTX_BAR_TICK_WIDTH });
  }
  ticks.sort((a, b) => a.pct - b.pct);
  return { span: CTX_BAR_SPAN, height: CTX_BAR_HEIGHT, fill: ctxFillPct(pct), ticks };
}

// ════════════════════════════════════════════════════════════════════════════════════════
// status — dot + words (token rule #7: status never rides on color alone)
// ════════════════════════════════════════════════════════════════════════════════════════

/** Lifecycle claims a product can make. Absent ⇒ the product reported no lifecycle. */
export type SessionLifecycle = "spawning" | "active" | "stopping" | "stopped" | "failed" | "paused";

/** Activity claims a product can make. Absent ⇒ NOT reported — never collapsed to `idle`. */
export type SessionActivity = "working" | "idle";

/** Colour axis. `"unknown"` is its own tone: the card renders a HOLLOW dot for it, so an
 *  unmeasured session cannot be mistaken for a solid-dot claim of any kind. */
export type SessionStatusTone = "ok" | "warn" | "error" | "info" | "muted" | "unknown";

export type SessionStatusKey =
  | "working"
  | "idle"
  | "spawning"
  | "active"
  | "stopping"
  | "stopped"
  | "failed"
  | "paused"
  | "disconnected"
  | "unknown";

export interface SessionStatus {
  /** Machine-readable outcome — what the card decided, independent of wording. */
  key: SessionStatusKey;
  /** Default wording; the binding lets a product override it with its own honest phrasing. */
  label: string;
  tone: SessionStatusTone;
  /** ≤1/s dot pulse — transient states only; a steady state never fakes motion. */
  pulse: boolean;
}

/** Everything the card needs to state a session's status. Every field is OPTIONAL, and every
 *  absent field means "the product did not report this" — never a default claim. */
export interface SessionStatusInput {
  lifecycle?: SessionLifecycle;
  activity?: SessionActivity;
  /** The session's link/wake readiness. `false` ⇒ down; `undefined` ⇒ not reported. */
  connected?: boolean;
}

const LIFECYCLE_STATUS: Record<SessionLifecycle, Omit<SessionStatus, "key">> = {
  spawning: { label: "spawning…", tone: "info", pulse: true },
  active: { label: "active", tone: "ok", pulse: false },
  stopping: { label: "stopping…", tone: "warn", pulse: true },
  stopped: { label: "stopped", tone: "muted", pulse: false },
  failed: { label: "failed", tone: "error", pulse: false },
  paused: { label: "paused", tone: "warn", pulse: false },
};

/** The honest "we were told nothing" status — distinct key AND distinct tone from `idle`. */
export const SESSION_STATUS_UNKNOWN: SessionStatus = {
  key: "unknown",
  label: "unknown",
  tone: "unknown",
  pulse: false,
};

/**
 * Derive the card's status. Precedence, and why:
 *
 *  1. A DOWN LINK on a session the product calls `active` — or on one whose lifecycle it does not
 *     report at all — wins: whatever else was claimed, we are not hearing from it. It does NOT
 *     override `spawning`/`stopping`/`stopped`/`failed`, whose own lifecycle already explains the
 *     missing link. The label is `"disconnected"`, not the design prototype's "reconnecting…":
 *     retry machinery is a product capability this atom cannot verify (a product that really does
 *     retry can pass its own `statusLabel`).
 *  2. An ACTIVITY claim, but only for a session that is `active` or has no reported lifecycle —
 *     a "working" claim about a stopped session is a contradiction, and the lifecycle is the
 *     stronger truth.
 *  3. The LIFECYCLE claim. This is where an active-but-no-activity session lands: `"active"`,
 *     never a fabricated `"idle"` or `"working"` (invariant 2).
 *  4. Nothing reported at all ⇒ `"unknown"` (invariant 2).
 */
export function sessionStatus(input?: SessionStatusInput | null): SessionStatus {
  const { lifecycle, activity, connected } = isObject(input) ? input : {};

  if (connected === false && (lifecycle === "active" || lifecycle === undefined)) {
    return { key: "disconnected", label: "disconnected", tone: "muted", pulse: true };
  }

  if (lifecycle === "active" || lifecycle === undefined) {
    if (activity === "working") return { key: "working", label: "working", tone: "ok", pulse: true };
    if (activity === "idle") return { key: "idle", label: "idle", tone: "muted", pulse: false };
  }

  if (lifecycle !== undefined) {
    const base = LIFECYCLE_STATUS[lifecycle];
    return { key: lifecycle, label: base.label, tone: base.tone, pulse: base.pulse };
  }

  return SESSION_STATUS_UNKNOWN;
}

/** Status class: tone modifier + the transient-pulse flag. The dot is a child element, so the
 *  modifier tints the words and the dot together. */
export function sessionStatusClass(status: SessionStatus): string {
  return `my-session-card__status my-session-card__status--${status.tone}${status.pulse ? " is-pulse" : ""}`;
}

/**
 * Whether the card wears the design's STALE treatment (dashed border, muted values) — true exactly
 * when the link is down. Kept here rather than in the binding so both bindings, and any product
 * that wants to pre-compute it, agree on one rule.
 */
export function sessionCardIsStale(status: SessionStatus): boolean {
  return status.key === "disconnected";
}

/**
 * The card's stale treatment, including a product's own claim. A product may ADD staleness (its
 * data is old for a reason the card cannot see); it may NOT take away the staleness a down link
 * implies — `stale={false}` on a disconnected session would paint it as a live, solid-bordered
 * card, which is exactly the lie this treatment exists to prevent.
 */
export function sessionCardStale(status: SessionStatus, productClaim?: boolean): boolean {
  return sessionCardIsStale(status) || productClaim === true;
}

/**
 * The words beside the dot. A product may substitute its own honest phrasing for the derived
 * label — the tone, the pulse and the stale treatment still come from the derivation.
 *
 * Two refusals:
 *   · a BLANK override falls back to the derived label, rather than leaving the status as colour
 *     alone (token rule #7);
 *   · the `unknown` status ignores the override entirely. There is no alternative honest wording
 *     for "the product told us nothing" — nothing was claimed, so there is nothing to reword —
 *     and accepting one would let `statusLabel="idle"` launder an absent signal into a positive
 *     claim, which is exactly what invariant 2 forbids.
 */
export function sessionStatusText(status: SessionStatus, override?: string | null): string {
  if (status.key === "unknown") return status.label;
  return typeof override === "string" && override.trim().length > 0 ? override : status.label;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// card container, identity line, subline
// ════════════════════════════════════════════════════════════════════════════════════════

/** Container class — the WHOLE class attribute the card's root carries, including any extra
 *  classes a product passes, so neither binding composes a class string of its own. `selected` and
 *  `stale` are INDEPENDENT: a selected session can also be disconnected, so they are two
 *  modifiers, never one enum. */
export function sessionCardClass(
  input?: { selected?: boolean; stale?: boolean; extra?: string | null } | null,
): string {
  const i = isObject(input) ? input : {};
  const extra = typeof i.extra === "string" ? i.extra.trim() : "";
  return (
    `my-session-card${i.selected === true ? " is-selected" : ""}${i.stale === true ? " is-stale" : ""}` +
    (extra.length > 0 ? ` ${extra}` : "")
  );
}

/** What an unnameable session's avatar shows — a question mark, not a fabricated initial. */
export const SESSION_AVATAR_UNKNOWN = "?";

/** Avatar initial: the first alphanumeric of the display name, uppercased; `"?"` when there is
 *  none. (Merges the two divergent copies the product carried — the rail card's "first char,
 *  em-dash fallback" and derive.ts's "first alphanumeric, ?-fallback" — on the latter, which
 *  cannot emit punctuation or whitespace as an initial.) */
export function sessionAvatarInitial(name: string | null | undefined): string {
  const m = String(name ?? "").match(/[a-z0-9]/i);
  return m ? m[0]!.toUpperCase() : SESSION_AVATAR_UNKNOWN;
}

/**
 * The card's meta subline — `role · model · duration` on the design card, but deliberately a free
 * list: the spec's own states also use it for `role · model · queued: 1 ON-DONE` and
 * `role · last seen 00:12 ago`. Absent/blank parts COLLAPSE, so there is never a dangling
 * separator, and an all-absent list yields `""` (the binding then omits the element entirely
 * rather than rendering an empty row).
 */
export function sessionSubline(parts?: readonly (string | null | undefined)[] | null): string {
  return (Array.isArray(parts) ? parts : [])
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0)
    .join(SESSION_CARD_SEP);
}

// ════════════════════════════════════════════════════════════════════════════════════════
// spine strip — filled nodes = distills, hollow node = the live tip
// ════════════════════════════════════════════════════════════════════════════════════════

export interface SessionSpine {
  /** Distills completed. `undefined` ⇒ the product did not report it — the strip is OMITTED. */
  distills?: number;
  /** Tokens saved. `undefined` ⇒ not reported — renders `"—"`, never `"0 tok"`. */
  savedTok?: number;
}

/**
 * The most nodes the strip will draw. The strip is a fixed-width row of 13px nodes, so beyond this
 * they cannot be told apart anyway — and a runaway count from a malformed wire value must not be
 * able to build an unbounded node list and lock the render. The LABEL beside the strip always
 * states the TRUE count, so the bound costs no honesty: the strip is a bounded illustration, the
 * number is the claim.
 */
export const SPINE_MAX_NODES = 24;

export interface SpineNode {
  /** The live tip (hollow); every other node is a completed distill (filled). */
  tip: boolean;
}

/**
 * Nodes for the strip: one filled node per completed distill, plus the hollow live tip.
 * An UNREPORTED `distills` yields `[]` — no strip, no fabricated "0 distills" (invariant 1). A
 * REPORTED 0 is a real reading and yields the tip alone. Non-integer/negative counts are floored,
 * and the list is capped at `SPINE_MAX_NODES` so a runaway value cannot lock the render (the
 * strip's label still states the true count).
 */
export function sessionSpineNodes(distills: number | null | undefined): SpineNode[] {
  if (!isReading(distills)) return [];
  const n = Math.min(SPINE_MAX_NODES - 1, Math.max(0, Math.floor(distills)));
  const nodes: SpineNode[] = [];
  for (let i = 0; i < n; i++) nodes.push({ tip: false });
  nodes.push({ tip: true });
  return nodes;
}

/** Compact token count: `41.2k`, `1.3M`, `412`. */
function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** What an unreported token saving renders as. */
export const SPINE_SAVED_UNKNOWN = CTX_UNKNOWN_TEXT;

/**
 * The strip's right-hand value. Absent ⇒ `"—"` (invariant 1). A saving is a REDUCTION, so it
 * carries a real minus sign (U+2212); a reported 0 is unsigned; a negative input (context grew)
 * is stated as growth rather than silently re-signed.
 */
export function sessionSpineSavedText(savedTok: number | null | undefined): string {
  if (!isReading(savedTok)) return SPINE_SAVED_UNKNOWN;
  if (savedTok === 0) return "0 tok";
  return `${savedTok > 0 ? "−" : "+"}${compactTokens(Math.abs(savedTok))} tok`;
}

/** The strip's left-hand label: `spine · 3 distills` (singular at 1). */
export function sessionSpineLabel(distills: number): string {
  const n = Math.max(0, Math.floor(distills));
  return `spine${SESSION_CARD_SEP}${n} ${n === 1 ? "distill" : "distills"}`;
}

export interface SpineSummary {
  nodes: SpineNode[];
  label: string;
  value: string;
}

/**
 * The whole strip, or `undefined` when the product reported no distill count — the card then
 * renders no strip at all. `spine.savedTok` is independent: a reported distill count with an
 * unreported saving still draws the strip, with `"—"` for the value.
 */
export function sessionSpineSummary(spine: SessionSpine | null | undefined): SpineSummary | undefined {
  if (!spine || !isReading(spine.distills)) return undefined;
  return {
    nodes: sessionSpineNodes(spine.distills),
    label: sessionSpineLabel(spine.distills),
    value: sessionSpineSavedText(spine.savedTok),
  };
}

/** Class for one spine node — filled distill vs. the hollow live tip. */
export function spineNodeClass(node: SpineNode): string {
  return `my-session-card__spine-node${node.tip ? " my-session-card__spine-node--tip" : ""}`;
}
