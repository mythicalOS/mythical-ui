// @mythicalos/ui-core — the stat-tile row's tone→class derivation + the value formatters
// (ds/components-stat-tiles.html: a flex-wrap row of bordered tiles, each an uppercase micro
// "key", a big mono tabular-nums value, and a mono sub-caption; the "brag" tile paints its value
// --my-accent-strong).
//
// Extracted from the reference implementation in the reference product's session detail pane. That
// version took the product's `SessionVm` and hard-coded the five session tiles (tokens in/out,
// prompt cache, cost, spine savings) INSIDE the component. That composition is the product's
// domain, not the design system's: the atom here takes an already-composed `StatTile[]`, so a
// consumer's view-model decides which tiles exist and in what order.
//
// What DID come along, because it is design and not product:
//   - the "—" placeholder: an absent value renders the em dash, never a fabricated `0` / `$0.00`
//     (partial data renders partially — never all-or-nothing),
//   - the Unicode minus (U+2212, not a hyphen) on negative compact counts — the design card's
//     spine-savings tile literally reads `−212k`,
//   - the warn/error tone tint, which the reference drove off the context gauge's own 75/90 bands
//     (token rule #4) — the thresholds themselves stay with the caller, only the tint is here.

/** Tile tone. `accent` is the design card's "brag" number (`.tile.save .v`); `warn`/`error` are the
 *  gauge-band tint. Absent ⇒ a plain tile. */
export type StatTileTone = "accent" | "warn" | "error";

export interface StatTile {
  /** Uppercase micro key, e.g. `tokens in`. */
  label: string;
  /** The already-formatted value — use the formatters below, or supply your own string. */
  value: string;
  /** Mono sub-caption under the value, e.g. `this session`. */
  sub?: string;
  tone?: StatTileTone;
}

/** The value shown when a number is absent or not finite. An em dash — NEVER a zero. */
export const STAT_TILE_EMPTY = "—";

/** Unicode minus (U+2212), not an ASCII hyphen: it matches the digit metrics of the tabular-nums
 *  mono face the tile value is set in. */
export const STAT_TILE_MINUS = "−";

/** Row container class. */
export function statTilesClass(): string {
  return "my-stat-tiles";
}

/** Tile class: base + optional tone modifier. */
export function statTileClass(tone?: StatTileTone): string {
  return tone === undefined ? "my-stat-tile" : `my-stat-tile my-stat-tile--${tone}`;
}

/** True only for a real, finite number — `undefined`, `null` and `NaN`/`Infinity` all fall through
 *  to `STAT_TILE_EMPTY` rather than being coerced. */
function isNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Strip a trailing `.0` so `230.0` → `230` while `12.8` stays `12.8`. */
function stripZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Sign prefix for an already-rounded magnitude string. A negative input whose ROUNDED magnitude is
 *  zero gets no sign — `−0` / `−$0.00` would be a lie about the direction of a value that landed on
 *  zero at display precision. */
function signed(n: number, body: string, zero: string): string {
  return n < 0 && body !== zero ? STAT_TILE_MINUS + body : body;
}

/** Compact count: `500`, `12.8k`, `230k`, `1.5M`; negatives take the Unicode minus (`−212k`).
 *  Absent/non-finite ⇒ `STAT_TILE_EMPTY`.
 *
 *  The unit is chosen from the ROUNDED value, not the raw one: rounding first and picking the unit
 *  second would render `999.5` as `1000` and `999_999` as `1000k` — values that are noncanonical
 *  for the scale and sit right in the middle of a normal token count. Each rung promotes to the
 *  next when its own rounding carries it to 1000. `M` is the top rung — the design card defines no
 *  unit above it, so a billion reads `1000M`, not `1B`. */
export function formatStatCompact(n: number | null | undefined): string {
  if (!isNum(n)) return STAT_TILE_EMPTY;
  const abs = Math.abs(n);
  let body: string;
  if (Math.round(abs) < 1000) body = String(Math.round(abs));
  else if (Number((abs / 1000).toFixed(1)) < 1000) body = `${stripZero((abs / 1000).toFixed(1))}k`;
  else body = `${stripZero((abs / 1_000_000).toFixed(1))}M`;
  return signed(n, body, "0");
}

/** Grouped count: `1,204,551` — the design card's tokens-in/out format. Deliberately NOT
 *  `toLocaleString()`: the card's grouping is a fixed visual (comma every three digits, mono
 *  tabular-nums), and a host locale must not silently turn it into `1.204.551`.
 *  Absent/non-finite ⇒ `STAT_TILE_EMPTY`. */
export function formatStatCount(n: number | null | undefined): string {
  if (!isNum(n)) return STAT_TILE_EMPTY;
  const grouped = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return signed(n, grouped, "0");
}

/** USD: `$4.18`, always two decimals. Absent/non-finite ⇒ `STAT_TILE_EMPTY`. */
export function formatStatUsd(n: number | null | undefined): string {
  if (!isNum(n)) return STAT_TILE_EMPTY;
  return signed(n, `$${Math.abs(n).toFixed(2)}`, "$0.00");
}

/** Percent: `71%` by default, `94.5%` at `digits: 1` — the design card shows both forms.
 *  Absent/non-finite ⇒ `STAT_TILE_EMPTY`. */
export function formatStatPercent(n: number | null | undefined, digits = 0): string {
  if (!isNum(n)) return STAT_TILE_EMPTY;
  const safeDigits = Math.max(0, Math.min(4, Math.trunc(digits)));
  const body = `${Math.abs(n).toFixed(safeDigits)}%`;
  return signed(n, body, `${(0).toFixed(safeDigits)}%`);
}
