// test/css-small-atoms.test.ts — stylesheet coverage for the three small atoms (save-bar,
// stat-tiles, git-chip). Sibling of test/css.test.ts's check (e): every class string the new logic
// EMITS must have a real selector in styles.css, and every element class the bindings render must
// exist too — a component whose classes have no rules ships invisible.
//
// It is a separate file (rather than more cases in css.test.ts) purely so this branch adds no
// contended edits to a file other in-flight work also touches.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  GIT_CHIP_PARTS,
  SAVE_BAR_PARTS,
  STAT_TILE_PARTS,
  gitChipClass,
  gitFlagClass,
  saveBarClass,
  statTileClass,
  statTilesClass,
  type GitFlagTone,
  type StatTileTone,
} from "../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

/** The canonical tokens live in the SIBLING mythical-design repo. Its location relative to this
 *  package differs between a normal checkout and a git worktree, so walk up until it is found
 *  instead of hard-coding a fixed number of `..` hops (test/css.test.ts's fixed `../../../../`
 *  resolves outside the tree when this package is checked out as a worktree). */
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

/** A real, standalone selector occurrence — `.my-stat-tile` must not be satisfied by
 *  `.my-stat-tiles`, and `.my-gitchip` must not be satisfied by `.my-gitchip__flag`. */
function hasClassSelector(className: string): boolean {
  return new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`).test(css);
}

function expectSelectorsFor(classString: string) {
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    expect({ token, found: hasClassSelector(token) }).toEqual({ token, found: true });
  }
}

describe("save bar", () => {
  test("saveBarClass's output has a selector", () => {
    expectSelectorsFor(saveBarClass());
  });
  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(SAVE_BAR_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });
  test("the horizontal padding is the card's 16px, on the canonical token", () => {
    const rule = css.match(/\.my-savebar\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("padding: 9px var(--my-sp-4)");
  });

  test("the card's 180ms slide-up exists AND has a prefers-reduced-motion opt-out", () => {
    expect(css).toContain("@keyframes my-savebar-up");
    expect(css).toMatch(/animation:\s*my-savebar-up\s+180ms/);
    const reduced = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([^}]*\}[^}]*)\}/g) ?? [];
    expect(reduced.some((block) => block.includes("my-savebar"))).toBe(true);
  });
});

describe("stat tiles", () => {
  test("statTilesClass / statTileClass output — every tone — has selectors", () => {
    expectSelectorsFor(statTilesClass());
    expectSelectorsFor(statTileClass());
    for (const tone of ["accent", "warn", "error"] as StatTileTone[]) {
      expectSelectorsFor(statTileClass(tone));
    }
  });
  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(STAT_TILE_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });
  test("values are mono + tabular-nums (the card's whole point)", () => {
    const rule = css.match(/\.my-stat-tile__value\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("font-family: var(--my-font-mono)");
    expect(rule?.[1]).toContain("font-variant-numeric: tabular-nums");
  });
});

describe("git chip", () => {
  test("gitChipClass output — every state combination — has selectors", () => {
    for (const state of [
      {},
      { unavailable: true },
      { stale: true },
      { unavailable: true, stale: true },
    ]) {
      expectSelectorsFor(gitChipClass(state));
    }
  });
  test("gitFlagClass output — every tone — has selectors", () => {
    for (const tone of ["warn", "error", "ok"] as GitFlagTone[]) expectSelectorsFor(gitFlagClass(tone));
  });
  test("EVERY declared part has a selector — enumerated from ui-core, not restated here", () => {
    for (const c of Object.values(GIT_CHIP_PARTS)) {
      expect({ c, found: hasClassSelector(c) }).toEqual({ c, found: true });
    }
  });
  test("the flags are the card's squared badge, not the pill chip", () => {
    const rule = css.match(/\.my-gitchip__flag\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toContain("border-radius: 4px");
    expect(rule?.[1]).not.toContain("--my-r-pill");
  });
});

describe("the new block obeys the sheet's standing rules", () => {
  const marker = "SMALL ATOMS";
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

  test("every --my-* token referenced in the block exists in the canonical tokens.css", () => {
    const defined = new Set(
      Array.from(stripComments(tokensCss).matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]),
    );
    const referenced = new Set(
      Array.from(block.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]),
    );
    expect(referenced.size).toBeGreaterThan(5);
    expect(Array.from(referenced).filter((t) => !defined.has(t)).sort()).toEqual([]);
  });
});
