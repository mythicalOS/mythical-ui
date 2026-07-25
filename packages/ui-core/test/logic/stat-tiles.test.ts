// test/logic/stat-tiles.test.ts — the stat-tile row's class derivation and value formatters
// (ds/components-stat-tiles.html). The card's own rendered values are the fixtures:
// `1,204,551` / `84,102` / `94.5%` / `$4.18` / `−212k`.
//
// The load-bearing guarantee under test is that an ABSENT number formats to the em-dash
// placeholder and never to a fabricated `0` / `$0.00` / `0%`.

import { describe, expect, test } from "bun:test";
import {
  STAT_TILE_EMPTY,
  STAT_TILE_MINUS,
  formatStatCompact,
  formatStatCount,
  formatStatPercent,
  formatStatUsd,
  statTileClass,
  statTilesClass,
  type StatTileTone,
} from "../../src/index.ts";

describe("class derivation", () => {
  test("row container", () => {
    expect(statTilesClass()).toBe("my-stat-tiles");
  });
  test("no tone ⇒ bare tile", () => {
    expect(statTileClass()).toBe("my-stat-tile");
    expect(statTileClass(undefined)).toBe("my-stat-tile");
  });
  test.each(["accent", "warn", "error"] as StatTileTone[])("tone=%s adds its modifier", (tone) => {
    expect(statTileClass(tone)).toBe(`my-stat-tile my-stat-tile--${tone}`);
  });
});

describe("absent values are the em dash — NEVER a fabricated zero", () => {
  const absent = [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  test.each(absent)("formatStatCompact(%p)", (n) => {
    expect(formatStatCompact(n as number)).toBe(STAT_TILE_EMPTY);
  });
  test.each(absent)("formatStatCount(%p)", (n) => {
    expect(formatStatCount(n as number)).toBe(STAT_TILE_EMPTY);
  });
  test.each(absent)("formatStatUsd(%p)", (n) => {
    expect(formatStatUsd(n as number)).toBe(STAT_TILE_EMPTY);
  });
  test.each(absent)("formatStatPercent(%p)", (n) => {
    expect(formatStatPercent(n as number)).toBe(STAT_TILE_EMPTY);
  });
  test("a real zero still renders as zero (the placeholder means ABSENT, not empty)", () => {
    expect(formatStatCompact(0)).toBe("0");
    expect(formatStatCount(0)).toBe("0");
    expect(formatStatUsd(0)).toBe("$0.00");
    expect(formatStatPercent(0)).toBe("0%");
  });
});

describe("formatStatCompact", () => {
  test.each([
    [500, "500"],
    [999, "999"],
    [999.4, "999"],
    [1000, "1k"],
    [12_800, "12.8k"],
    [230_000, "230k"],
    [1_500_000, "1.5M"],
    [1_000_000, "1M"],
  ] as [number, string][])("%p ⇒ %p", (n, expected) => {
    expect(formatStatCompact(n)).toBe(expected);
  });

  test("the card's spine-savings value uses the UNICODE minus, not a hyphen", () => {
    expect(formatStatCompact(-212_000)).toBe("−212k");
    expect(formatStatCompact(-212_000)).toStartWith(STAT_TILE_MINUS);
    expect(formatStatCompact(-212_000)).not.toStartWith("-");
  });

  test("a negative that rounds to zero is not signed (no `−0`)", () => {
    expect(formatStatCompact(-0.4)).toBe("0");
    expect(formatStatCompact(-0)).toBe("0");
  });
});

describe("formatStatCount — the card's grouped tokens-in/out format", () => {
  test.each([
    [1_204_551, "1,204,551"],
    [84_102, "84,102"],
    [999, "999"],
    [1000, "1,000"],
    [1_000_000, "1,000,000"],
  ] as [number, string][])("%p ⇒ %p", (n, expected) => {
    expect(formatStatCount(n)).toBe(expected);
  });

  test("grouping is fixed, not host-locale dependent", () => {
    expect(formatStatCount(1_204_551)).not.toContain(".");
    expect(formatStatCount(1_204_551)).not.toContain(" ");
  });

  test("negatives take the Unicode minus; a negative rounding to zero is unsigned", () => {
    expect(formatStatCount(-84_102)).toBe("−84,102");
    expect(formatStatCount(-0.2)).toBe("0");
  });
});

describe("formatStatUsd", () => {
  test("the card's cost tile", () => {
    expect(formatStatUsd(4.18)).toBe("$4.18");
  });
  test("always two decimals", () => {
    expect(formatStatUsd(4)).toBe("$4.00");
    expect(formatStatUsd(4.125)).toBe("$4.13");
  });
  test("negatives sign the whole amount with the Unicode minus", () => {
    expect(formatStatUsd(-4.18)).toBe("−$4.18");
    expect(formatStatUsd(-0.001)).toBe("$0.00");
  });
});

describe("formatStatPercent", () => {
  test("default rounds to a whole percent", () => {
    expect(formatStatPercent(71)).toBe("71%");
    expect(formatStatPercent(70.6)).toBe("71%");
  });
  test("digits:1 reproduces the card's cache tile", () => {
    expect(formatStatPercent(94.5, 1)).toBe("94.5%");
  });
  test("digits is clamped to a sane range and truncated to an integer", () => {
    expect(formatStatPercent(94.5, -3)).toBe("95%");
    expect(formatStatPercent(94.5, 1.9)).toBe("94.5%");
    expect(formatStatPercent(94.5, 99)).toBe("94.5000%");
  });
  test("negatives take the Unicode minus; a negative rounding to zero is unsigned", () => {
    expect(formatStatPercent(-12)).toBe("−12%");
    expect(formatStatPercent(-0.2)).toBe("0%");
  });
});
