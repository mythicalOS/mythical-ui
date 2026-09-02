// test/css-button-tone-line.test.ts — the tone-OUTLINED button block (additions section; ported
// upstream from the product mockups' review rows). Sibling of test/css-button-tone.test.ts, and
// guards the decisions that make this block the fill's honest mirror:
//   (a) every arm is the `.btn--dan` recipe verbatim per tone — surface fill, tone border, tone
//       ink, tone-soft hover; NOTHING is derived (no color-mix), because every hover already has
//       a minted soft token,
//   (b) the error arm is EQUIVALENT to `.btn--dan` (the uniform-axis decision) — the recipes are
//       compared token-for-token so they cannot drift apart silently,
//   (c) disabled out-ranks the (0,3,0) per-tone hover rules, exactly as the fill block's fix,
//   (d) the block is token-driven — no theme-scoped selector — and sits BEFORE the fill block,
//       whose disabled override must remain the sheet's last interactive `.btn--tone*` rule
//       (the ordering the fill's own gate pins).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");

const TONES = ["ok", "warn", "info", "error"] as const;

/** The tone-line block: from the base rule through the disabled override. */
function toneLineSlice(): string {
  const start = css.indexOf(".btn--tone-line {");
  expect(start).toBeGreaterThan(-1);
  const endMarker = ".btn--tone-line[data-tone].is-disabled";
  const end = css.indexOf("}", css.indexOf(endMarker));
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end + 1);
}

describe("tone-outlined button — per-tone border/ink, selector-bound", () => {
  test("each data-tone rest rule pairs its status token on border AND ink", () => {
    const slice = toneLineSlice();
    for (const tone of TONES) {
      // Bound to ITS selector — a swapped pair (ok border on warn) must fail.
      const re = new RegExp(
        `\\.btn--tone-line\\[data-tone="${tone}"\\]\\s*\\{\\s*border-color:\\s*var\\(--my-${tone}\\);\\s*color:\\s*var\\(--my-${tone}\\);\\s*\\}`,
      );
      expect({ tone, bound: re.test(slice) }).toEqual({ tone, bound: true });
    }
  });

  test("each data-tone hover is ITS minted soft — never a derived color-mix", () => {
    const slice = toneLineSlice();
    for (const tone of TONES) {
      const re = new RegExp(
        `\\.btn--tone-line\\[data-tone="${tone}"\\]:hover,\\s*` +
          `\\.btn--tone-line\\[data-tone="${tone}"\\]\\.is-hover\\s*` +
          `\\{\\s*background:\\s*var\\(--my-${tone}-soft\\);\\s*\\}`,
      );
      expect({ tone, bound: re.test(slice) }).toEqual({ tone, bound: true });
    }
    // The `.btn--dan` precedent hovers into a minted soft; the fill block derives because fills
    // have no minted hover step — outlines do, so a color-mix here would be an invented value.
    expect(slice).not.toContain("color-mix");
  });

  test("bare tone-line (and data-tone=\"accent\" by fall-through) is the accent outline", () => {
    const slice = toneLineSlice();
    expect(slice).toContain(
      ".btn--tone-line { background: var(--my-surface); border-color: var(--my-accent); color: var(--my-accent-strong); }",
    );
    expect(slice).toContain(
      ".btn--tone-line:hover, .btn--tone-line.is-hover { background: var(--my-accent-soft); }",
    );
    // No dedicated accent attribute rules — accent must fall through to the bare rules.
    expect(slice).not.toContain('[data-tone="accent"]');
  });

  test("no separate :active — the .btn--dan recipe has none, and the mirror keeps its grammar", () => {
    const slice = toneLineSlice();
    expect(slice).not.toContain(":active");
    expect(slice).not.toContain(".is-active");
  });
});

describe("tone-outlined button — the error arm ≡ .btn--dan, token for token", () => {
  test("rest and hover recipes match the standing danger-outline contract exactly", () => {
    // .btn--dan (BASE section): surface fill, error border, error ink, error-soft hover.
    expect(css).toContain(
      ".btn--dan { background: var(--my-surface); border-color: var(--my-error); color: var(--my-error); }",
    );
    expect(css).toContain(".btn--dan:hover, .btn--dan.is-hover { background: var(--my-error-soft); }");
    // The mirror's error arm: same border/ink pair on the tone-line base's surface fill, same
    // hover soft — asserted in the per-tone tests above; here we pin that BOTH spellings exist,
    // so routing error either way renders one look.
    const slice = toneLineSlice();
    expect(slice).toContain('.btn--tone-line[data-tone="error"]');
  });
});

describe("tone-outlined button — disabled out-ranks tone", () => {
  test("the override carries the [data-tone] (0,3,0) forms and neutralizes the boundary", () => {
    const slice = toneLineSlice();
    expect(slice).toContain(".btn--tone-line[data-tone]:disabled");
    expect(slice).toContain(".btn--tone-line[data-tone].is-disabled");
    const m = slice.match(/\.btn--tone-line\[data-tone\]\.is-disabled\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toContain("background: var(--my-disabled-bg)");
    expect(m?.[1]).toContain("color: var(--my-disabled-ink)");
    expect(m?.[1]).toContain("border-color: transparent");
  });

  test("nothing interactive for this variant follows its disabled override", () => {
    // Comment-stripped remainder of the WHOLE sheet, exactly as the fill block's gate checks.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const disabledIdx = stripped.indexOf(".btn--tone-line:disabled");
    expect(disabledIdx).toBeGreaterThan(-1);
    const disabledEnd = stripped.indexOf("}", stripped.indexOf("{", disabledIdx));
    expect(disabledEnd).toBeGreaterThan(disabledIdx);
    const rest = stripped.slice(disabledEnd);
    expect(rest).not.toMatch(/\.btn--tone-line[^{}]*(?::hover|:active|\.is-hover|\.is-active)/);
  });

  test("the block sits BEFORE the fill block, whose disabled override stays the sheet's last", () => {
    expect(css.indexOf(".btn--tone-line {")).toBeGreaterThan(-1);
    expect(css.indexOf(".btn--tone-line {")).toBeLessThan(css.indexOf(".btn--tone {"));
  });
});

describe("tone-outlined button — theme flip is token-driven", () => {
  test("the block carries no theme-scoped selector", () => {
    const slice = toneLineSlice();
    expect(slice).not.toContain("data-theme");
    expect(slice).not.toContain(".my-dark");
  });
});
