// test/logic/tone.test.ts — tone type derivation and class/glyph generation.
// Ports from design-export reference components (StatusLine, Banner).
//
// `chipClass` used to be tested here too. The v2 Chip card grew it a size axis, two more tones and
// three element variants, so the whole chip family moved to src/logic/chip.ts and its coverage
// moved with it — see test/logic/chip.test.ts. This file must not re-derive a chip class: one
// source of truth, one suite.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  statusLineClass,
  bannerClass,
  BANNER_ICON,
  type StatusTone,
  type BannerTone,
} from "../../src/logic/tone.ts";

describe("tone.ts owns no chip derivation", () => {
  test("the module never spells a chip class — chip.ts is the only source", () => {
    // A second `my-chip` derivation here is the exact drift the consolidation removed: the two
    // could disagree, and the disagreement would only ever surface in a browser.
    const src = readFileSync(join(import.meta.dir, "..", "..", "src", "logic", "tone.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain("my-chip");
    expect(code).not.toContain("chipClass");
  });
});

describe("statusLineClass — status tone to class string derivation", () => {
  test("all status tones include the base + modifier", () => {
    expect(statusLineClass("ok")).toBe("my-status my-status--ok");
    expect(statusLineClass("warn")).toBe("my-status my-status--warn");
    expect(statusLineClass("error")).toBe("my-status my-status--error");
    expect(statusLineClass("info")).toBe("my-status my-status--info");
    expect(statusLineClass("muted")).toBe("my-status my-status--muted");
    expect(statusLineClass("accent")).toBe("my-status my-status--accent");
  });

  test("all 6 status tones are supported", () => {
    const tones: StatusTone[] = [
      "ok",
      "warn",
      "error",
      "info",
      "muted",
      "accent",
    ];
    tones.forEach((tone) => {
      const cls = statusLineClass(tone);
      expect(cls).toMatch(/^my-status my-status--/);
    });
  });
});

describe("bannerClass — banner tone to class string derivation", () => {
  test("all banner tones include the base + modifier", () => {
    expect(bannerClass("warn")).toBe("my-banner my-banner--warn");
    expect(bannerClass("info")).toBe("my-banner my-banner--info");
    expect(bannerClass("ok")).toBe("my-banner my-banner--ok");
    expect(bannerClass("error")).toBe("my-banner my-banner--error");
  });

  test("all 4 banner tones are supported", () => {
    const tones: BannerTone[] = ["warn", "info", "ok", "error"];
    tones.forEach((tone) => {
      const cls = bannerClass(tone);
      expect(cls).toMatch(/^my-banner my-banner--/);
    });
  });
});

describe("BANNER_ICON — glyph map for banner tones", () => {
  test("all 6 banner tones have glyphs", () => {
    expect(BANNER_ICON.warn).toBe("▲");
    expect(BANNER_ICON.info).toBe("ℹ");
    expect(BANNER_ICON.ok).toBe("✓");
    expect(BANNER_ICON.error).toBe("✕");
    expect(BANNER_ICON.accent).toBe("◆");
    expect(BANNER_ICON.neutral).toBe("○");
  });

  test("has exactly 6 entries (no accidental extras)", () => {
    const keys = Object.keys(BANNER_ICON);
    expect(keys.length).toBe(6);
    expect(keys.sort()).toEqual(["accent", "error", "info", "neutral", "ok", "warn"]);
  });

  test("glyphs are non-empty strings", () => {
    Object.values(BANNER_ICON).forEach((glyph) => {
      expect(typeof glyph).toBe("string");
      expect(glyph.length).toBeGreaterThan(0);
    });
  });
});
