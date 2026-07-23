// test/css.test.ts — the package's component stylesheet (Task 3). styles.css ships the atom
// classes that src/logic/ derives (buttonClass, chipClass, statusLineClass, bannerClass,
// gaugeTone) and that both the Preact and React bindings render, so this guards:
//   (a) zero hard-coded hex colors outside CSS comments (everything visual is a --my-* token),
//   (b) zero raw `px` font-size values in the NEW "additions" section (see scoping note below),
//   (c) every --my-* token *referenced* here actually exists in the canonical tokens.css — this
//       is the regression test for the "design-export's tokens.css is v0.4-era/stale" fidelity
//       check (e.g. it would have caught the .my-gauge__track / .my-search__input remaps),
//   (d) none of the later-task shell classes (topbar/switcher/nav/split/rail/settings/iconbtn/
//       app/page/menu/logo) leak in here — this package owns atoms only,
//   (e) every class the Task 2 logic actually emits has a real selector in this file.
//
// Scoping note on (b): styles.css has two sections — a BASE that is mythical-skuld's shipped,
// already-gated atom sheet taken verbatim (per the task, its class names and rules are not to be
// touched), and an ADDITIONS section newly authored/extracted for this task. The base predates
// the font-size-must-be-a-token discipline and is full of fine-tuned literal px sizes (11px,
// 12.5px, 13px, …) that don't sit on the --my-fs-* scale — rewriting them would violate the
// "take wholesale, don't rename/modify" instruction. So (b) is scoped to the additions section,
// which this task fully controls and which now tokenizes every font-size declaration.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bannerClass,
  buttonClass,
  chipClass,
  gaugeTone,
  statusLineClass,
  type BannerTone,
  type BtnVariant,
  type ChipTone,
  type StatusTone,
} from "../src/index.ts";

const stylesPath = join(import.meta.dir, "..", "styles.css");
const tokensPath = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "mythical-design",
  "tokens.css",
);

const css = readFileSync(stylesPath, "utf8");
const tokensCss = readFileSync(tokensPath, "utf8");

const ADDITIONS_MARKER = "/* @section: additions */";

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function additionsSlice(text: string): string {
  const idx = text.indexOf(ADDITIONS_MARKER);
  if (idx === -1) throw new Error(`ADDITIONS_MARKER not found in styles.css — expected "${ADDITIONS_MARKER}"`);
  return text.slice(idx);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `css` has a real, standalone selector occurrence of `.className` — i.e. not just a
 * prefix of some longer class (`.btn` must not match only inside `.btn--pri`). */
function hasClassSelector(cssText: string, className: string): boolean {
  const re = new RegExp(`\\.${escapeRegex(className)}(?![\\w-])`);
  return re.test(cssText);
}

describe("styles.css — (a) zero hard-coded hex colors outside comments", () => {
  test("no #hex color literal appears outside a CSS comment", () => {
    const stripped = stripComments(css);
    const hexMatches = stripped.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hexMatches).toEqual([]);
  });

  test("sanity: the known historical hex literals DO still exist, but only inside comments", () => {
    // Guards against the stripComments() helper silently no-op-ing (a false-negative trap).
    expect(css).toContain("#0A0C10");
    expect(css).toContain("#C9C3B6");
  });
});

describe("styles.css — (b) additions section: zero raw px font-size values", () => {
  test("every font-size declaration in the additions section uses a var(--my-fs-*) token", () => {
    const additions = additionsSlice(css);
    const rawPxFontSizes = additions.match(/font-size:\s*[\d.]+px/g) ?? [];
    expect(rawPxFontSizes).toEqual([]);
  });

  test("the additions section is non-empty (the scan itself is meaningful)", () => {
    const additions = additionsSlice(css);
    expect(additions.length).toBeGreaterThan(500);
  });
});

describe("styles.css — (c) every referenced --my-* token exists in the canonical tokens.css", () => {
  const definedTokens = new Set(
    Array.from(stripComments(tokensCss).matchAll(/(--my-[a-zA-Z0-9-]+)(?=\s*:)/g)).map((m) => m[1]),
  );

  test("the canonical tokens.css actually defines a non-trivial set of tokens (sanity)", () => {
    expect(definedTokens.size).toBeGreaterThan(20);
  });

  test("every var(--my-*) reference in styles.css resolves to a defined canonical token", () => {
    const referenced = new Set(
      Array.from(css.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]),
    );
    const missing = Array.from(referenced).filter((name) => !definedTokens.has(name)).sort();
    expect(missing).toEqual([]);
  });
});

describe("styles.css — (d) no later-task shell classes leak into this atom sheet", () => {
  const forbiddenPrefixes = [
    "my-topbar",
    "my-switcher",
    "my-nav",
    "my-split",
    "my-rail",
    "my-settings",
    "my-iconbtn",
    "my-app",
    "my-page",
    "my-menu",
    "my-logo",
  ];

  test.each(forbiddenPrefixes)("does not define .%s*", (prefix) => {
    expect(css.includes(`.${prefix}`)).toBe(false);
  });
});

describe("styles.css — (e) every class Task 2's logic emits exists as a selector", () => {
  function expectSelectorsFor(classString: string) {
    for (const token of classString.split(/\s+/).filter(Boolean)) {
      expect(hasClassSelector(css, token)).toBe(true);
    }
  }

  test("buttonClass — all 5 variants × representative states", () => {
    const variants: BtnVariant[] = ["pri", "acc", "sec", "gho", "dan"];
    const states = [
      {},
      { small: true },
      { disabled: true },
      { loading: true },
      { block: true },
      { small: true, disabled: true },
    ];
    for (const variant of variants) {
      for (const state of states) {
        expectSelectorsFor(buttonClass(variant, state));
      }
    }
  });

  test("chipClass — all 6 tones", () => {
    const tones: ChipTone[] = ["neutral", "accent", "ok", "warn", "error", "info"];
    for (const tone of tones) expectSelectorsFor(chipClass(tone));
  });

  test("statusLineClass — all 6 tones", () => {
    const tones: StatusTone[] = ["ok", "warn", "error", "info", "muted", "accent"];
    for (const tone of tones) expectSelectorsFor(statusLineClass(tone));
  });

  test("bannerClass — all 4 tones", () => {
    const tones: BannerTone[] = ["warn", "info", "ok", "error"];
    for (const tone of tones) expectSelectorsFor(bannerClass(tone));
  });

  test("gaugeTone — .my-gauge__fill--{ok,warn,error} for every tone it can return", () => {
    const pctSamples = [0, 50, 74, 75, 89, 90, 100];
    const tones = new Set(pctSamples.map((pct) => gaugeTone(pct)));
    expect(tones).toEqual(new Set(["ok", "warn", "error"]));
    for (const tone of tones) {
      expect(hasClassSelector(css, `my-gauge__fill--${tone}`)).toBe(true);
    }
  });
});
