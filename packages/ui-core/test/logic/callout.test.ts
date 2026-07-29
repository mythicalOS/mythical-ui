// test/logic/callout.test.ts — class derivation and copy for the callout family + its "?" opener
// (ds/components-callout, the mockup gap wave). The tone vocabulary is ENUMERATED from the
// exported constant, and the rule-7 glyph coverage is proven against the banner's own map — the
// callout deliberately mints no second glyph derivation.

import { describe, expect, test } from "bun:test";
import {
  CALLOUT_PARTS,
  CALLOUT_TONES,
  HELP_GLYPH,
  HELP_LABEL,
  calloutClass,
  helpClass,
  type CalloutTone,
} from "../../src/logic/callout.ts";
import { BANNER_ICON, type BannerTone } from "../../src/logic/tone.ts";

describe("calloutClass — tone", () => {
  test("accent is the DEFAULT and emits no modifier (the base rule already paints it)", () => {
    expect(calloutClass()).toBe("my-callout");
    expect(calloutClass("accent")).toBe("my-callout");
  });

  test("every other tone adds exactly one modifier", () => {
    expect(calloutClass("ok")).toBe("my-callout my-callout--ok");
    expect(calloutClass("warn")).toBe("my-callout my-callout--warn");
    expect(calloutClass("info")).toBe("my-callout my-callout--info");
    expect(calloutClass("error")).toBe("my-callout my-callout--error");
    expect(calloutClass("neutral")).toBe("my-callout my-callout--neutral");
  });

  test("the tone set is exactly these six, in card order", () => {
    expect([...CALLOUT_TONES]).toEqual(["accent", "ok", "warn", "info", "error", "neutral"]);
    for (const tone of CALLOUT_TONES) expect(calloutClass(tone).startsWith("my-callout")).toBe(true);
  });

  test("an unknown tone degrades to the default instead of emitting a rule-less modifier", () => {
    expect(calloutClass("err" as CalloutTone)).toBe("my-callout");
    expect(calloutClass(undefined as unknown as CalloutTone)).toBe("my-callout");
    expect(calloutClass(null as unknown as CalloutTone)).toBe("my-callout");
  });
});

describe("rule 7 — every callout tone has a glyph, from the banner's own map", () => {
  test("every CalloutTone indexes BANNER_ICON (the bindings consume it directly)", () => {
    for (const tone of CALLOUT_TONES) {
      const glyph = BANNER_ICON[tone as BannerTone];
      expect({ tone, glyph: typeof glyph }).toEqual({ tone, glyph: "string" });
      expect(glyph.length).toBeGreaterThan(0);
    }
  });
});

describe("helpClass — the family's opener", () => {
  test("base, and the is-open state", () => {
    expect(helpClass()).toBe("my-help");
    expect(helpClass({ open: false })).toBe("my-help");
    expect(helpClass({ open: true })).toBe("my-help is-open");
  });

  test("only a real `true` opens — the paint must never disagree with aria-expanded", () => {
    expect(helpClass({ open: 1 as unknown as boolean })).toBe("my-help");
    expect(helpClass(null as never)).toBe("my-help");
  });

  test("the glyph and the default accessible name are the pages' own", () => {
    expect(HELP_GLYPH).toBe("?");
    expect(HELP_LABEL).toBe("What is this?");
  });
});

describe("the parts map", () => {
  test("every class the bindings render is declared once, here", () => {
    expect(CALLOUT_PARTS).toEqual({
      root: "my-callout",
      title: "my-callout__title",
      kicker: "my-callout__kicker",
      glyph: "my-callout__glyph",
      body: "my-callout__body",
      acts: "my-callout__acts",
      help: "my-help",
    });
  });
});
