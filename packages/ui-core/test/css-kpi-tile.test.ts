// test/css-kpi-tile.test.ts — stylesheet coverage for the KPI tile family (gauge/spark/split/
// footer). Sibling of test/css.test.ts's check (e) and test/css-small-atoms.test.ts: every class
// string src/logic/kpi-tile.ts EMITS must have a real selector in styles.css.
//
// It is a separate file (rather than more cases in css.test.ts or css-small-atoms.test.ts) purely
// so this branch adds no contended edits to a file other in-flight work also touches.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  KPI_TILE_PARTS,
  kpiBandClass,
  kpiDeltaClass,
  kpiGaugeWrapClass,
  kpiSparkClass,
  kpiTileClass,
  type StatTileTone,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

/** The canonical tokens live in the SIBLING mythical-design repo. Its location relative to this
 *  package differs between a normal checkout and a git worktree, so walk up until it is found
 *  instead of hard-coding a fixed number of `..` hops. */
function findTokensCss(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 10; i++) {
    const candidate = join(dir, "mythical-design", "tokens.css");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("canonical mythical-design/tokens.css not found above " + import.meta.dir);
}

const tokensCss = readFileSync(findTokensCss(), "utf8");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A real, standalone (or compound-descendant) selector occurrence — `.my-kpi-tile` must not be
 *  satisfied by `.my-kpi-tile__band`, but `.my-kpi-gauge .my-gauge__track` DOES satisfy
 *  `.my-kpi-gauge` (a space, not a word/hyphen char, follows it). */
function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(css);
}

function expectSelectorsFor(classString: string) {
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    expect({ token, found: hasClassSelector(token) }).toEqual({ token, found: true });
  }
}

describe("KPI tile — class derivation output has real selectors", () => {
  test("kpiTileClass — every stat-tile tone", () => {
    expectSelectorsFor(kpiTileClass());
    for (const tone of ["accent", "warn", "error", "ok"] as StatTileTone[]) {
      expectSelectorsFor(kpiTileClass(tone));
    }
  });

  test("kpiGaugeWrapClass", () => {
    expectSelectorsFor(kpiGaugeWrapClass());
  });

  test("kpiSparkClass — both tone modifiers have selectors", () => {
    // NOT expectSelectorsFor's blanket per-token check: like the shared `.my-gauge`/`.my-kpi-gauge`
    // wrappers, the family ROOT (`my-kpi-spark`) is a bare marker with no rule of its own — every
    // rule is either the element classes (`__area`/`__line`/…) or compound with a tone modifier.
    // Asserting the bare root would fail exactly the way `.btn` must not be satisfied by
    // `.btn--pri` (test/css.test.ts's own hasClassSelector doc comment).
    expect(hasClassSelector("my-kpi-spark--ok")).toBe(true);
    expect(hasClassSelector("my-kpi-spark--warn")).toBe(true);
    expect(kpiSparkClass(true)).toContain("my-kpi-spark--ok");
    expect(kpiSparkClass(false)).toContain("my-kpi-spark--warn");
  });

  test("kpiDeltaClass — every tone", () => {
    for (const tone of ["ok", "warn", "muted"] as const) expectSelectorsFor(kpiDeltaClass(tone));
  });

  test("kpiBandClass — both states", () => {
    expectSelectorsFor(kpiBandClass(false));
    expectSelectorsFor(kpiBandClass(true));
  });

  test("EVERY declared KPI_TILE_PARTS entry has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(KPI_TILE_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });

  test("the split-bar segment tones each have a selector", () => {
    for (const tone of ["accent", "warn", "muted"]) {
      const cls = `my-kpi-split__seg--${tone}`;
      expect({ cls, found: hasClassSelector(cls) }).toEqual({ cls, found: true });
    }
  });

  test("the sparkline's element classes each have a selector (area/line/dot/band)", () => {
    for (const el of ["area", "line", "dot", "band"]) {
      const cls = `my-kpi-spark__${el}`;
      expect({ cls, found: hasClassSelector(cls) }).toEqual({ cls, found: true });
    }
  });

  test("the mini gauge reuses the shared --info fill modifier (not a KPI-only color)", () => {
    expect(hasClassSelector("my-gauge__fill--info")).toBe(true);
  });
});

describe("the new block obeys the sheet's standing rules", () => {
  const marker = "KPI TILE";
  const block = css.slice(css.indexOf(marker));

  test("the block is found and non-trivial (the scan is meaningful)", () => {
    expect(css.indexOf(marker)).toBeGreaterThan(-1);
    expect(block.length).toBeGreaterThan(1000);
  });

  test("zero hard-coded hex colors outside comments", () => {
    expect(stripComments(block).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });

  test("zero raw px font-size values — every one resolves through a --my-fs-* token", () => {
    expect(block.match(/font-size:\s*[\d.]+px/g) ?? []).toEqual([]);
  });

  test("the tile note (10px) and delta row (11px) map onto EXACT token steps, not an approximation", () => {
    const note = css.match(/\.my-kpi-tile__note\s*\{([^}]*)\}/);
    expect(note?.[1]).toContain("font-size: var(--my-fs-nano)");
    const delta = css.match(/\.my-kpi-tile__delta-row\s*\{([^}]*)\}/);
    expect(delta?.[1]).toContain("font-size: var(--my-fs-micro)");
    // sanity: nano is exactly 10px and micro is exactly 11px in the canonical scale — these are
    // exact matches, not the "nearest step" approximation the sheet uses elsewhere.
    expect(tokensCss).toMatch(/--my-fs-nano:\s*10px/);
    expect(tokensCss).toMatch(/--my-fs-micro:\s*11px/);
  });

  test("the sparkline's soft area fill is .1 opacity (the spec's own doc-typo correction, not .09)", () => {
    const rule = css.match(/\.my-kpi-spark__area\s*\{([^}]*)\}/);
    expect(rule?.[1]).toContain("fill-opacity: .1;");
  });

  test("every --my-* token referenced in the block exists in the canonical tokens.css", () => {
    const defined = new Set(
      Array.from(stripComments(tokensCss).matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]),
    );
    const referenced = new Set(Array.from(block.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]));
    expect(referenced.size).toBeGreaterThan(5);
    expect(Array.from(referenced).filter((t) => !defined.has(t)).sort()).toEqual([]);
  });

  test("the mini gauge's stroke-width override is scoped under .my-kpi-gauge, never bare on the shared rule", () => {
    // A bare, unscoped `.my-gauge__track { stroke-width: ... }` or `.my-gauge__fill { stroke-width:
    // ... }` would silently override the packaged <Gauge> atom's variable `stroke` prop for every
    // OTHER consumer (a CSS declaration beats an SVG presentation attribute). Guard: every
    // `stroke-width` declaration in this block's own selectors must be scoped under `.my-kpi-`.
    const decls = Array.from(block.matchAll(/([^{}]+)\{[^{}]*stroke-width:\s*5[^{}]*\}/g)).map((m) => m[1]!.trim());
    expect(decls.length).toBeGreaterThan(0);
    for (const selector of decls) expect(selector).toContain(".my-kpi-");
  });
});
