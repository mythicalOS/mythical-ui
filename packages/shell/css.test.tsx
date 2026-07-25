/** @jsxImportSource preact */
// packages/shell/css.test.tsx — the package's stylesheet, mirroring ui-core's
// test/css.test.ts. styles.css ships ONLY the shell class families (top bar, logo, product
// switcher, nav tabs, icon button, overflow menu, workspace split/rail/rail-card, settings nav,
// app/page frame) that this package's components render. This guards:
//   (a) zero hard-coded hex colors outside CSS comments (everything visual is a --my-* token),
//   (b) tokens-only discipline for font-size: every declaration uses a var(--my-fs-*) token,
//       EXCEPT the documented literal exceptions (see styles.css's top-of-file fidelity note):
//       `.my-logo__product` (8px), `.my-switcher__here` (9px) and `.my-switcher__section` (9px),
//       where the nearest scale step is a >20% jump judged too large to snap silently. Unlike
//       ui-core's BASE/ADDITIONS split, this file has no inherited legacy section to exempt
//       wholesale — it is all new extraction — so the allowance here is a narrow, named allowlist
//       of exactly those three declarations, not a whole-section carve-out.
//   (c) every --my-* token *referenced* here actually exists in the canonical tokens.css,
//   (d) none of ui-core's ATOM classes (button/input/toggle/checkbox/chip/card/avatar/status/
//       search/banner/gauge/toast/dialog/empty/spine/…) are redefined here — the mirror image of
//       ui-core's own test/css.test.ts (d), which forbids every prefix this file owns,
//   (e) every class this package's components actually render has a real selector in this file,
//   (f) the switcher panel's command-center section matches the design source's metrics.

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
  TokenGate,
  TopBar,
  WorkspaceSplit,
  PRODUCTS,
} from "./src/index.ts";
import { SwitcherPanel } from "./src/ProductSwitcher.tsx";
import { TokenGateCard } from "./src/TokenGate.tsx";

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
  // .my-logo__product (8px); .my-switcher__here + .my-switcher__section (9px) — see fidelity note
  const ALLOWED_LITERALS = new Set(["8px", "9px"]);

  test("every raw px font-size declaration is one of the documented, named exceptions", () => {
    const rawPxFontSizes = Array.from(css.matchAll(/font-size:\s*([\d.]+px)/g)).map((m) => m[1]!);
    const unexpected = rawPxFontSizes.filter((v) => !ALLOWED_LITERALS.has(v));
    expect(unexpected).toEqual([]);
  });

  test("the documented exceptions are still present, and no more of them than documented", () => {
    expect((css.match(/font-size: 8px/g) ?? []).length).toBe(1);
    expect((css.match(/font-size: 9px/g) ?? []).length).toBe(2);
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

describe("styles.css — (g) TokenGate's card ships fully styled from the packaged stylesheets", () => {
  // TokenGate is the one shell component that composes ui-core ATOMS (Input, Button), so its
  // emitted classes are split across two sheets by design: the `.token-entry*` family belongs to
  // this package, everything else must already resolve in ui-core's. Consumers concatenate both,
  // so this pair of assertions is what proves the card needs no copied CSS in any product.
  const uiCoreCss = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");

  const rendered = renderToString(
    <TokenGate product="brokkr" container="mythical" onSubmit={() => {}} invalid status={401} reason="bad token" />,
  );
  // The copy controls' two settled states are state-driven, so they are unreachable through
  // `TokenGate` without a DOM (see token-gate.test.tsx's depth note) — rendered here off the
  // hook-free card directly, so their classes are held to the same "must resolve" rule.
  const withCopyStates = ["copied", "failed"].map((_s, i) =>
    renderToString(
      <TokenGateCard
        product="brokkr"
        container="mythical"
        onSubmit={() => {}}
        value=""
        onValue={() => {}}
        copy={{ target: "retrieve", ok: i === 0 }}
      />,
    ),
  );
  const emitted = new Set<string>();
  for (const html of [rendered, ...withCopyStates]) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
    }
  }

  test("the card renders its own class family", () => {
    for (const c of [
      "token-entry",
      "token-entry__title",
      "token-entry__body",
      "token-entry__err",
      "token-entry__err-glyph",
      "token-entry__cta",
      "token-entry__hint",
      "token-entry__cmd",
      "token-entry__cmd-row",
      "token-entry__copy",
      "token-entry__copy-status",
      "is-copied",
      "is-failed",
    ]) {
      expect(emitted.has(c)).toBe(true);
      expect(hasClassSelector(css, c)).toBe(true);
    }
  });

  test("every class it emits resolves in THIS package's sheet or in ui-core's — nothing is unstyled", () => {
    const missing = [...emitted].filter(
      (c) => !hasClassSelector(css, c) && !hasClassSelector(uiCoreCss, c),
    );
    expect(missing).toEqual([]);
  });

  test("the atoms it composes are still owned by ui-core, not restated here", () => {
    for (const c of ["input", "btn", "field", "input-reveal__btn"]) {
      expect(emitted.has(c) || rendered.includes(`${c} `) || rendered.includes(`"${c}"`)).toBe(true);
      expect(hasClassSelector(css, c)).toBe(false);
      expect(hasClassSelector(uiCoreCss, c)).toBe(true);
    }
  });

  test("card geometry: 400px, centred, surface + border, modal radius and shadow", () => {
    const rule = css.match(/\.token-entry\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    const r = rule![0];
    expect(r).toContain("max-width: 400px");
    expect(r).toContain("margin: 0 auto");
    expect(r).toContain("background: var(--my-surface)");
    expect(r).toContain("border: 1px solid var(--my-border)");
    expect(r).toContain("border-radius: var(--my-r-modal)");
    expect(r).toContain("box-shadow: var(--my-shadow-modal)");
  });

  test("the CTA stretches its single child to full width without restating any .btn rule", () => {
    const rule = css.match(/\.token-entry__cta\s*\{[^}]*\}/);
    expect(rule?.[0]).toContain("display: grid");
  });

  test("the hint block is separated by a top rule and set in the mono face", () => {
    const rule = css.match(/\.token-entry__hint\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("border-top: 1px solid var(--my-border)");
    expect(rule![0]).toContain("font-family: var(--my-font-mono)");
  });

  test("the command still takes the row, so the copy control never squeezes it out", () => {
    const row = css.match(/\.token-entry__cmd-row\s*\{[^}]*\}/);
    expect(row?.[0]).toContain("display: flex");
    const cmd = css.match(/\.token-entry__cmd\s*\{[^}]*\}/);
    expect(cmd?.[0]).toContain("flex: 1 1 auto");
    expect(cmd?.[0]).toContain("min-width: 0");
    // the line is still ordinary selectable text — nothing here may turn selection off
    expect(cmd?.[0]).not.toContain("user-select");
  });

  test("the copy control is a bordered control with the family's focus ring", () => {
    const rule = css.match(/\.token-entry__copy\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    // rule #11 — it is a real interactive control, so its boundary is --my-control-border
    expect(rule![0]).toContain("border: 1px solid var(--my-control-border)");
    expect(rule![0]).toContain("cursor: pointer");
    expect(css).toContain(".token-entry__copy:focus-visible");
    expect(css.match(/\.token-entry__copy:focus-visible\s*\{[^}]*\}/)?.[0]).toContain(
      "outline: 2px solid var(--my-accent)",
    );
  });

  test("both copy outcomes resolve through tokens that are redefined in BOTH themes", () => {
    // --my-ok / --my-warn each have a light AND a dark value in the canonical sheet, which is what
    // makes the control legible in either theme with no theme-specific rule here.
    expect(css.match(/\.token-entry__copy\.is-copied\s*\{[^}]*\}/)?.[0]).toContain("var(--my-ok)");
    expect(css.match(/\.token-entry__copy\.is-failed\s*\{[^}]*\}/)?.[0]).toContain("var(--my-warn)");
    for (const token of ["--my-ok", "--my-warn"]) {
      expect((tokensCss.match(new RegExp(`${token}\\s*:`, "g")) ?? []).length).toBeGreaterThan(1);
    }
  });

  test("the copy announcement is off-screen but never display:none — it must stay announceable", () => {
    const rule = css.match(/\.token-entry__copy-status\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("position: absolute");
    expect(rule![0]).toContain("clip-path: inset(50%)");
    expect(rule![0]).not.toContain("display: none");
    expect(rule![0]).not.toContain("visibility: hidden");
  });
});

describe("styles.css — (f) the switcher's command-center section matches the design source", () => {
  test("the panel divider uses the design source's 7px 8px 4px margin", () => {
    const rule = css.match(/\.my-switcher__divider\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[0]).toContain("margin: 7px 8px 4px");
  });

  test(".my-switcher__section carries the design source's label metrics", () => {
    const rule = css.match(/\.my-switcher__section\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    const r = rule![0];
    expect(r).toContain("font-size: 9px");
    expect(r).toContain("letter-spacing: 1.4px");
    expect(r).toContain("text-transform: uppercase");
    expect(r).toContain("padding: 3px 10px 4px");
    expect(r).toContain("var(--my-muted)");
  });

  test("the mark tile the command-center row shares with the product rows is 32px on the design's hover surface", () => {
    const rule = css.match(/\.my-switcher__mark\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    const r = rule![0];
    expect(r).toContain("width: 32px");
    expect(r).toContain("height: 32px");
    expect(r).toContain("background: var(--my-surface-hover)");
  });

  test("the trailing dot is 7px, and the not-yet-built variant the command-center row uses exists", () => {
    const dot = css.match(/\.my-switcher__dot\s*\{[^}]*\}/);
    expect(dot).not.toBeNull();
    expect(dot![0]).toContain("width: 7px");
    expect(dot![0]).toContain("height: 7px");
    expect(hasClassSelector(css, "my-switcher__dot--soon")).toBe(true);
  });

  test("the retired footer-note rules are gone — no component renders them any more", () => {
    expect(hasClassSelector(css, "my-switcher__note")).toBe(false);
    expect(hasClassSelector(css, "my-switcher__note-glyph")).toBe(false);
  });
});
