/** @jsxImportSource preact */
// packages/shell/logo.test.tsx — the family logo. `Logo` is rendered in every logo slot a product
// has (top bar via ProductSwitcher, auth screen, setup-wizard header), so this pins the one rule
// the design source establishes for all of them: THE MARK IS THE PRODUCT YOU ARE IN. The generic
// family mark (`LogoMark`) survives only as the fallback for a key with no registered art, and as
// a still-public export.
//
// Same idiom as the package's other suites: render-to-string, no DOM (`Logo` is hook-free).

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import { Logo, LogoMark, PRODUCTS } from "./src/index.ts";

// The distinguishing path/attribute of each registered product glyph (see src/ProductGlyph.tsx).
const GLYPH_SIGNATURE: Record<string, string> = {
  brokkr: 'x="28" y="24" width="34" height="17"',
  skuld: "M10 24c26 0 34 20 46 23",
  saga: 'cx="44" cy="22" rx="26" ry="9"',
};
const FAMILY_MARK_PATH = "M48 204V72L128 152L208 72V168";

describe("Logo — the mark is the product you are in", () => {
  test("every family product's logo renders that product's own glyph", () => {
    for (const p of PRODUCTS) {
      const html = renderToString(<Logo product={p.key} />);
      expect(html).toContain(GLYPH_SIGNATURE[p.key]!);
    }
  });

  test("no product's logo renders another product's glyph, or the generic family mark", () => {
    for (const p of PRODUCTS) {
      const html = renderToString(<Logo product={p.key} />);
      for (const other of PRODUCTS) {
        if (other.key === p.key) continue;
        expect(html).not.toContain(GLYPH_SIGNATURE[other.key]!);
      }
      expect(html).not.toContain(FAMILY_MARK_PATH);
    }
  });

  test("the mark defaults to the design source's 30px logo-slot size", () => {
    const html = renderToString(<Logo product="brokkr" />);
    expect(html).toContain('width="30" height="30"');
  });

  test("an explicit size flows through to the glyph", () => {
    const html = renderToString(<Logo product="brokkr" size={48} />);
    expect(html).toContain('width="48" height="48"');
  });

  test("the wordmark still renders 'mythical' over the product line", () => {
    const html = renderToString(<Logo product="brokkr" />);
    expect(html).toContain("my-logo__family");
    expect(html).toContain(">mythical<");
    expect(html).toContain('class="my-logo__product">brokkr<');
  });

  test("the glyph is token-colored (theme-aware), never hardcoded hex", () => {
    const html = renderToString(<Logo product="skuld" />);
    expect(html).toContain("var(--my-ink)");
    expect(html).toContain("var(--my-accent)");
    expect(html).not.toMatch(/#(16181D|0F6B66|ECE7DE|3FB8AE)/i);
  });
});

describe("Logo — productKey vs the wordmark's display line", () => {
  test("`productKey` selects the glyph while `product` stays the display line", () => {
    const html = renderToString(<Logo productKey="saga" product="the chronicler" />);
    expect(html).toContain(GLYPH_SIGNATURE["saga"]!);
    expect(html).toContain('class="my-logo__product">the chronicler<');
  });

  test("a display-cased product line still resolves its glyph (keys are case-folded)", () => {
    const html = renderToString(<Logo product="BROKKR" />);
    expect(html).toContain(GLYPH_SIGNATURE["brokkr"]!);
  });
});

describe("Logo — the fallback: never a hole in the top bar", () => {
  test("a product key with no registered art falls back to the generic family mark", () => {
    const html = renderToString(<Logo product="nonexistent" />);
    expect(html).toContain("my-logo__mark");
    expect(html).toContain(FAMILY_MARK_PATH);
  });

  test("no product at all still renders a mark", () => {
    const html = renderToString(<Logo />);
    expect(html).toContain("my-logo__mark");
    expect(html).toContain(FAMILY_MARK_PATH);
  });

  test("exactly one mark wrapper is emitted in either branch (glyph or fallback)", () => {
    for (const product of ["brokkr", "nonexistent"]) {
      const html = renderToString(<Logo product={product} />);
      expect((html.match(/class="my-logo__mark"/g) ?? []).length).toBe(1);
    }
  });
});

describe("LogoMark — still a public export", () => {
  test("renders the generic family mark standalone, unchanged", () => {
    const html = renderToString(<LogoMark />);
    expect(html).toContain("my-logo__mark");
    expect(html).toContain(FAMILY_MARK_PATH);
    expect(html).toContain('width="34"'); // its own default size is unchanged
  });
});
