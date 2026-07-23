// test/logic/tone.test.ts — tone type derivation and class/glyph generation.
// Ports from design-export reference components (Chip, StatusLine, Banner).

import { describe, expect, test } from "bun:test";
import {
  chipClass,
  statusLineClass,
  bannerClass,
  BANNER_ICON,
  type ChipTone,
  type StatusTone,
  type BannerTone,
} from "../../src/logic/tone.ts";

describe("chipClass — chip tone to class string derivation", () => {
  test("neutral tone has no modifier suffix", () => {
    expect(chipClass("neutral")).toBe("my-chip");
  });

  test("non-neutral tones include the tone modifier", () => {
    expect(chipClass("accent")).toBe("my-chip my-chip--accent");
    expect(chipClass("ok")).toBe("my-chip my-chip--ok");
    expect(chipClass("warn")).toBe("my-chip my-chip--warn");
    expect(chipClass("error")).toBe("my-chip my-chip--error");
    expect(chipClass("info")).toBe("my-chip my-chip--info");
  });

  test("all 6 chip tones are supported", () => {
    const tones: ChipTone[] = [
      "neutral",
      "accent",
      "ok",
      "warn",
      "error",
      "info",
    ];
    tones.forEach((tone) => {
      const cls = chipClass(tone);
      expect(cls).toMatch(/^my-chip/);
    });
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
  test("all 4 banner tones have glyphs", () => {
    expect(BANNER_ICON.warn).toBe("▲");
    expect(BANNER_ICON.info).toBe("ℹ");
    expect(BANNER_ICON.ok).toBe("✓");
    expect(BANNER_ICON.error).toBe("✕");
  });

  test("has exactly 4 entries (no accidental extras)", () => {
    const keys = Object.keys(BANNER_ICON);
    expect(keys.length).toBe(4);
    expect(keys.sort()).toEqual(["error", "info", "ok", "warn"]);
  });

  test("glyphs are non-empty strings", () => {
    Object.values(BANNER_ICON).forEach((glyph) => {
      expect(typeof glyph).toBe("string");
      expect(glyph.length).toBeGreaterThan(0);
    });
  });
});
