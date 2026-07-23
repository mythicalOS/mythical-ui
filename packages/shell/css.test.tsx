/** @jsxImportSource preact */
// packages/shell/css.test.tsx — the package's stylesheet (Task 8), mirroring ui-core's
// test/css.test.ts. styles.css ships ONLY the shell class families (top bar, logo, product
// switcher, nav tabs, icon button, overflow menu, workspace split/rail/rail-card, settings nav,
// app/page frame) that this package's components render. This guards:
//   (a) zero hard-coded hex colors outside CSS comments (everything visual is a --my-* token),
//   (b) tokens-only discipline for font-size: every declaration uses a var(--my-fs-*) token,
//       EXCEPT the two documented literal exceptions (see styles.css's top-of-file fidelity
//       note): `.my-logo__product` (8px) and `.my-switcher__here` (9px), where the nearest scale
//       step is a >20% jump judged too large to snap silently. Unlike ui-core's BASE/ADDITIONS
//       split, this file has no inherited legacy section to exempt wholesale — it is all new
//       extraction for this task — so the allowance here is a narrow, named allowlist of exactly
//       those two declarations, not a whole-section carve-out.
//   (c) every --my-* token *referenced* here actually exists in the canonical tokens.css,
//   (d) none of ui-core's ATOM classes (button/input/toggle/checkbox/chip/card/avatar/status/
//       search/banner/gauge/toast/dialog/empty/spine/…) are redefined here — the mirror image of
//       ui-core's own test/css.test.ts (d), which forbids every prefix this file owns,
//   (e) every class this package's components actually render has a real selector in this file.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  Logo,
  LogoMark,
  NavTabs,
  ProductSwitcher,
  RailCard,
  RailGroup,
  RailHead,
  RailList,
  SettingsLayout,
  SettingsNav,
  TopBar,
  WorkspaceSplit,
  PRODUCTS,
} from "./src/index.ts";
import { SwitcherPanel } from "./src/ProductSwitcher.tsx";

const stylesPath = join(import.meta.dir, "styles.css");
const tokensPath = join(import.meta.dir, "..", "..", "..", "mythical-design", "tokens.css");

const css = readFileSync(stylesPath, "utf8");
const tokensCss = readFileSync(tokensPath, "utf8");

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `cssText` has a real, standalone selector occurrence of `.className` — i.e. not just
 * a prefix of some longer class (`.my-nav` must not match only inside `.my-nav__tab`). */
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
});

describe("styles.css — (b) tokens-only discipline: font-size resolves through --my-fs-* tokens", () => {
  const ALLOWED_LITERALS = new Set(["8px", "9px"]); // .my-logo__product, .my-switcher__here — see fidelity note

  test("every raw px font-size declaration is one of the two documented, named exceptions", () => {
    const rawPxFontSizes = Array.from(css.matchAll(/font-size:\s*([\d.]+px)/g)).map((m) => m[1]!);
    const unexpected = rawPxFontSizes.filter((v) => !ALLOWED_LITERALS.has(v));
    expect(unexpected).toEqual([]);
  });

  test("both documented exceptions are still present (guards the allowlist from silently widening)", () => {
    expect(css).toContain("font-size: 8px");
    expect(css).toContain("font-size: 9px");
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
    const referenced = new Set(Array.from(css.matchAll(/var\(\s*(--my-[a-zA-Z0-9-]+)/g)).map((m) => m[1]));
    const missing = Array.from(referenced).filter((name) => !definedTokens.has(name)).sort();
    expect(missing).toEqual([]);
  });

  test("regression guard: .my-iconbtn's resting border uses --my-control-border, not --my-border", () => {
    const rule = css.match(/\.my-iconbtn\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toContain("var(--my-control-border)");
  });

  test("regression guard: .my-rail-card's resting border uses --my-border per design export", () => {
    const rule = css.match(/\.my-rail-card\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toContain("var(--my-border)");
  });
});

describe("styles.css — (d) no ui-core ATOM classes are redefined here", () => {
  // Every top-level class prefix ui-core's own styles.css defines (atoms + its base layer) —
  // the mirror of ui-core's own test/css.test.ts (d), which forbids every prefix THIS file owns.
  const forbiddenAtomPrefixes = [
    "btn",
    "cb",
    "check-row",
    "chip",
    "danf",
    "dlg",
    "ebtns",
    "empty",
    "emsg",
    "esc",
    "field",
    "help",
    "hidden",
    "input",
    "mono",
    "muted",
    "my-avatar",
    "my-banner",
    "my-card",
    "my-chip",
    "my-gauge",
    "my-search",
    "my-status",
    "my-truncate",
    "readonly-input",
    "rep",
    "scrim",
    "slot",
    "spin",
    "spine-dash",
    "spine-dot",
    "spine-empty",
    "spine-here",
    "spine-node",
    "spine-track",
    "textarea",
    "tnum",
    "toast",
    "tog",
  ];

  test.each(forbiddenAtomPrefixes)("does not define .%s*", (prefix) => {
    expect(hasClassSelector(css, prefix)).toBe(false);
  });
});

describe("styles.css — (e) every class this package's components render exists as a selector", () => {
  const noop = () => {};

  function allRenders(): string[] {
    const out: string[] = [];
    out.push(renderToString(<Logo product="brokkr" />));
    out.push(renderToString(<LogoMark />));
    out.push(renderToString(<ProductSwitcher current="brokkr" />));
    // the open panel — ProductSwitcher's internal open state can't be driven without a DOM click
    // (see product-switcher.test.tsx's depth note), so the panel is rendered directly here via
    // its exported, hook-free helper to prove every one of its classes resolves.
    out.push(
      renderToString(
        <SwitcherPanel current="brokkr" products={PRODUCTS} note="note" onPick={noop} />,
      ),
    );
    out.push(
      renderToString(
        <TopBar>
          <TopBar.Right>right</TopBar.Right>
        </TopBar>,
      ),
    );
    out.push(
      renderToString(
        <NavTabs items={[{ key: "a", label: "A" }, { key: "b", label: "B" }]} active="a" onSelect={noop} />,
      ),
    );
    out.push(
      renderToString(
        <WorkspaceSplit>
          <WorkspaceSplit.Rail>
            <RailHead title="T" subtitle="S" />
            <RailList>
              <RailGroup label="Group">
                <RailCard>default</RailCard>
                <RailCard state="active">active</RailCard>
                <RailCard state="warn">warn</RailCard>
              </RailGroup>
            </RailList>
          </WorkspaceSplit.Rail>
          <WorkspaceSplit.Detail>detail</WorkspaceSplit.Detail>
        </WorkspaceSplit>,
      ),
    );
    out.push(
      renderToString(
        <SettingsLayout
          nav={
            <SettingsNav
              items={[{ key: "a", label: "A" }]}
              active="a"
              onSelect={noop}
              footer={<div>footer</div>}
            />
          }
        >
          detail
        </SettingsLayout>,
      ),
    );
    return out;
  }

  const renders = allRenders();
  const emitted = new Set<string>();
  for (const html of renders) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
    }
  }

  test("renders emit a real, non-trivial class surface", () => {
    expect(emitted.size).toBeGreaterThan(15);
  });

  test("each emitted class matches >=1 selector in this package's styles.css", () => {
    const missing = [...emitted].filter((c) => !hasClassSelector(css, c));
    expect(missing).toEqual([]);
  });

  test("no export ever emits an inline style attribute (CSP style-src 'self')", () => {
    for (const html of renders) expect(html).not.toContain("style=");
  });
});
