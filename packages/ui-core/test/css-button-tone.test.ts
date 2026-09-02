// test/css-button-tone.test.ts — the tone-filled button block (additions section; spec originated
// pane-side as SPEC-btn-tone during the mockup rewire). Guards the three decisions that made this
// block canonical-shaped rather than the mirror-side draft it replaced:
//   (a) hover/active are DERIVED (color-mix toward --my-ink) — toward the theme's ink, never a
//       fixed `black`: light ink darkens the fill, heritage's cream ink lightens it, matching the
//       dark hover grammar of --my-accent-hover/--my-ink-hover,
//   (b) the theme flip of the label ink is TOKEN-driven (--my-tone-ink, defined in both theme
//       blocks of the canonical tokens.css) — this sheet stays free of [data-theme]/.my-dark
//       selectors,
//   (c) disabled out-ranks the (0,3,0) per-tone hover/active rules — :hover matches a disabled
//       button under a pointer, so the override needs the [data-tone] forms AND last position.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "..", "styles.css"), "utf8");
const tokensCss = readFileSync(
  join(import.meta.dir, "..", "..", "..", "..", "mythical-design", "tokens.css"),
  "utf8",
);

const TONES = ["ok", "warn", "error", "info"] as const;

/** The tone block: from the .btn--tone base rule through the disabled override. */
function toneSlice(): string {
  const start = css.indexOf(".btn--tone {");
  expect(start).toBeGreaterThan(-1);
  const endMarker = ".btn--tone[data-tone].is-disabled";
  const end = css.indexOf("}", css.indexOf(endMarker));
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end + 1);
}

describe("tone-filled button — fills and derivation", () => {
  test("each data-tone rest fill is its status token, verbatim", () => {
    for (const tone of TONES) {
      const re = new RegExp(
        `\\.btn--tone\\[data-tone="${tone}"\\]\\s*\\{ background: var\\(--my-${tone}\\); \\}`,
      );
      expect(css).toMatch(re);
    }
  });

  test("hover mixes 88% toward --my-ink, active 76% — never toward a colour literal", () => {
    const slice = toneSlice();
    for (const tone of TONES) {
      // Each derivation is bound to ITS selector — a swapped pair (ok hover on warn) must fail.
      for (const [pseudo, forced, pct] of [
        [":hover", ".is-hover", "88"],
        [":active", ".is-active", "76"],
      ] as const) {
        const re = new RegExp(
          `\\.btn--tone\\[data-tone="${tone}"\\]${pseudo},\\s*` +
            `\\.btn--tone\\[data-tone="${tone}"\\]\\${forced}\\s*` +
            `\\{ background: color-mix\\(in oklab, var\\(--my-${tone}\\) ${pct}%, var\\(--my-ink\\)\\); \\}`,
        );
        expect(slice).toMatch(re);
      }
    }
    // WHITELIST, not blacklist: every color-mix in the block must be exactly the sanctioned
    // form — status token at 88/76% toward --my-ink. Mixing toward any constant (black, a hex,
    // a functional colour) is the exact defect the block replaced: black darkens in BOTH
    // themes, and heritage hovers must lighten.
    const mixes = slice.match(/color-mix\([^;}]*\)/g) ?? [];
    expect(mixes.length).toBe(TONES.length * 2);
    for (const m of mixes) {
      expect(m).toMatch(/^color-mix\(in oklab, var\(--my-(ok|warn|error|info)\) (88|76)%, var\(--my-ink\)\)$/);
    }
  });

  test("bare tone (and data-tone=\"accent\" by fall-through) keeps accent's hand-tuned steps", () => {
    const slice = toneSlice();
    expect(slice).toContain(".btn--tone:hover,  .btn--tone.is-hover  { background: var(--my-accent-hover); }");
    expect(slice).toContain(".btn--tone:active, .btn--tone.is-active { background: var(--my-accent-strong); }");
    // No dedicated accent attribute rules — accent must fall through to the bare rules.
    expect(slice).not.toContain('[data-tone="accent"]');
  });
});

describe("tone-filled button — theme flip is token-driven", () => {
  test("the block carries no theme-scoped selector", () => {
    const slice = toneSlice();
    expect(slice).not.toContain("data-theme");
    expect(slice).not.toContain(".my-dark");
  });

  test("label ink is --my-tone-ink, defined in BOTH theme blocks of canonical tokens.css", () => {
    expect(toneSlice()).toContain("color: var(--my-tone-ink);");
    const defs = tokensCss.match(/--my-tone-ink\s*:/g) ?? [];
    expect(defs.length).toBe(2);
    // The heritage definition must ride --my-bg (near-black on the light heritage hues).
    const darkIdx = tokensCss.indexOf('[data-theme="dark"]');
    expect(darkIdx).toBeGreaterThan(-1);
    const darkBlock = tokensCss.slice(darkIdx);
    expect(darkBlock).toMatch(/--my-tone-ink:\s*var\(--my-bg\)/);
  });
});

describe("tone-filled button — disabled out-ranks tone", () => {
  test("the disabled override carries the [data-tone] (0,3,0) forms and nothing interactive follows it", () => {
    const slice = toneSlice();
    expect(slice).toContain(".btn--tone[data-tone]:disabled");
    expect(slice).toContain(".btn--tone[data-tone].is-disabled");
    // Order is checked against the comment-stripped REMAINDER OF THE WHOLE SHEET, not the slice:
    // the slice ends at the disabled rule, so an interactive .btn--tone rule appended after it
    // would be invisible to a slice-scoped check — and CSS comments must not satisfy or trip it.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const disabledIdx = stripped.indexOf(".btn--tone:disabled");
    expect(disabledIdx).toBeGreaterThan(-1);
    const disabledEnd = stripped.indexOf("}", stripped.indexOf("{", disabledIdx));
    expect(disabledEnd).toBeGreaterThan(disabledIdx);
    const rest = stripped.slice(disabledEnd);
    expect(rest).not.toMatch(/\.btn--tone[^{}]*(?::hover|:active|\.is-hover|\.is-active)/);
  });

  test("the override styles with the shared disabled tokens", () => {
    const m = toneSlice().match(/\.btn--tone\[data-tone\]\.is-disabled\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m?.[1]).toContain("background: var(--my-disabled-bg)");
    expect(m?.[1]).toContain("color: var(--my-disabled-ink)");
  });
});
