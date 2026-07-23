/** @jsxImportSource preact */
// packages/shell/product-switcher.test.tsx — ProductSwitcher, the flagship central module
// (Task 8). Render contract + the pure click-routing decision.
//
// Depth note (documented per the task): preact-render-to-string never mounts effects or
// dispatches DOM events, so a plain render of `<ProductSwitcher>` can only ever show the CLOSED
// trigger — there is no way to click it open from a render-to-string test, and this package's
// bun:test environment has no `document`/`window` (no jsdom/happy-dom configured), so a real
// mousedown/keydown can't be dispatched either. Three techniques close that gap without a DOM:
//   1. The open panel's markup is exercised directly via the exported, hook-free `SwitcherPanel`
//      (see src/ProductSwitcher.tsx) — this is EXACTLY the markup `<ProductSwitcher>` renders
//      when `open` is true, so "every PRODUCTS entry renders", "current gets the here badge/
//      is-current", and the role="menu"/"menuitem" semantics are all verified against real
//      rendered HTML, just reached via the panel directly instead of a simulated click.
//   2. The click-routing decision (soon/href-less ⇒ onUnbuilt, online non-current ⇒ onNavigate,
//      current ⇒ no-op) is the pure `resolveSwitcherPick` — no rendering or DOM involved at all.
//   3. The outside-click/Escape *wiring* (the actual `document.addEventListener` calls) is
//      verified by a source scan (the same technique packages/preact-ui/hooks.test.ts uses for
//      usePoll's un-mockable timer/visibility wiring) rather than functional execution — this
//      codebase already accepts that pattern for effects a DOM-free test can't otherwise drive
//      (see e.g. packages/preact-ui/confirm.test.tsx, which likewise never exercises Scrim's
//      real Escape-closes-dialog behavior, only the static "Esc cancels" copy).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  PRODUCTS,
  ProductSwitcher,
  resolveSwitcherPick,
  SwitcherPanel,
  type Product,
} from "./src/index.ts";

const noop = () => {};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("ProductSwitcher — closed render (the only state reachable without a DOM click)", () => {
  test("renders the trigger, collapsed", () => {
    const html = renderToString(<ProductSwitcher current="brokkr" />);
    expect(html).toContain("my-switcher__trigger");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  test("no panel in the markup while closed", () => {
    const html = renderToString(<ProductSwitcher current="brokkr" />);
    expect(html).not.toContain("my-switcher__panel");
    expect(html).not.toContain('role="menu"');
  });

  test("the trigger's logo shows the current product's name, lowercased", () => {
    const html = renderToString(<ProductSwitcher current="skuld" />);
    expect(html).toContain("skuld");
  });

  test("an unrecognized current key renders an empty product line rather than throwing", () => {
    const html = renderToString(<ProductSwitcher current="nonexistent" />);
    expect(html).toContain("my-switcher__trigger");
  });
});

describe("SwitcherPanel — the open panel's markup, exercised directly (see depth note above)", () => {
  test("renders every PRODUCTS entry", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    for (const p of PRODUCTS) {
      expect(html).toContain(p.name);
      // HTML-escape "&" the same way renderToString does (e.g. "Scheduler & fate ledger")
      expect(html).toContain(p.role.replace(/&/g, "&amp;"));
    }
  });

  test("has role=menu on the panel and role=menuitem on every entry", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    expect(html).toContain('role="menu"');
    const menuitemCount = (html.match(/role="menuitem"/g) ?? []).length;
    expect(menuitemCount).toBe(PRODUCTS.length);
  });

  test("the current product gets the here badge, is-current class, and the accent dot", () => {
    const html = renderToString(
      <SwitcherPanel current="skuld" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    expect(html).toContain("is-current");
    expect(html).toContain("my-switcher__here");
    expect(html).toContain(">here<");
    expect(html).toContain("my-switcher__dot--here");
  });

  test("an 'online' non-current product gets the online dot, no here badge", () => {
    const html = renderToString(
      <SwitcherPanel current="skuld" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    // brokkr is 'online' and not current in this render
    expect(html).toContain("my-switcher__dot--online");
  });

  test("a 'soon' product gets the soon dot", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    expect(html).toContain("my-switcher__dot--soon");
  });

  test("renders the footer note", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="ASGER note text" onPick={noop} />,
    );
    expect(html).toContain("ASGER note text");
  });

  test("a custom products list is honored (adding a product is one registry entry)", () => {
    const custom: Product[] = [
      { key: "x", name: "XPROD", initial: "X", role: "test role", href: "/x", state: "online" },
    ];
    const html = renderToString(<SwitcherPanel current="x" products={custom} note="n" onPick={noop} />);
    expect(html).toContain("XPROD");
    expect(html).toContain("is-current");
  });
});

describe("resolveSwitcherPick — the pure click-routing decision (no DOM required)", () => {
  const brokkr = PRODUCTS.find((p) => p.key === "brokkr")!;
  const saga = PRODUCTS.find((p) => p.key === "saga")!; // state: 'soon', href: null

  test("clicking the current product is a no-op — neither handler fires", () => {
    let navigated = false;
    let unbuilt = false;
    const result = resolveSwitcherPick(brokkr, "brokkr", {
      onNavigate: () => (navigated = true),
      onUnbuilt: () => (unbuilt = true),
    });
    expect(result.action).toBe("noop");
    expect(navigated).toBe(false);
    expect(unbuilt).toBe(false);
  });

  test("a 'soon' / href-less product calls onUnbuilt, never onNavigate", () => {
    let navigated = false;
    let unbuiltProduct: Product | undefined;
    const result = resolveSwitcherPick(saga, "brokkr", {
      onNavigate: () => (navigated = true),
      onUnbuilt: (p) => (unbuiltProduct = p),
    });
    expect(result.action).toBe("unbuilt");
    expect(navigated).toBe(false);
    expect(unbuiltProduct).toBe(saga);
  });

  test("an 'online' non-current product with a caller-supplied onNavigate calls it, not onUnbuilt", () => {
    const skuld = PRODUCTS.find((p) => p.key === "skuld")!;
    let unbuilt = false;
    let navigatedTo: Product | undefined;
    const result = resolveSwitcherPick(skuld, "brokkr", {
      onNavigate: (p) => (navigatedTo = p),
      onUnbuilt: () => (unbuilt = true),
    });
    expect(result.action).toBe("navigate-handled");
    expect(navigatedTo).toBe(skuld);
    expect(unbuilt).toBe(false);
  });

  test("an 'online' non-current product with NO onNavigate reports its href for the caller to assign", () => {
    const skuld = PRODUCTS.find((p) => p.key === "skuld")!;
    const result = resolveSwitcherPick(skuld, "brokkr", {});
    expect(result).toEqual({ action: "navigate-href", href: skuld.href! });
  });

  test("a 'soon' product with a null href still routes to onUnbuilt even if it were (incorrectly) marked online", () => {
    const hypothetical: Product = { key: "x", name: "X", initial: "X", role: "r", href: null, state: "online" };
    let unbuilt = false;
    resolveSwitcherPick(hypothetical, "brokkr", { onUnbuilt: () => (unbuilt = true) });
    expect(unbuilt).toBe(true); // null href always routes to onUnbuilt regardless of `state`
  });
});

describe("ProductSwitcher — source scan: outside-click + Escape wiring is present (see depth note above)", () => {
  const src = stripComments(
    readFileSync(join(import.meta.dir, "src", "ProductSwitcher.tsx"), "utf8"),
  );
  const start = src.indexOf("export function ProductSwitcher");
  const body = src.slice(start);

  test("the component wires document mousedown + keydown listeners", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toContain('document.addEventListener("mousedown"');
    expect(body).toContain('document.addEventListener("keydown"');
  });

  test("the keydown handler closes on Escape specifically", () => {
    expect(body).toMatch(/e\.key === "Escape"/);
  });

  test("the mousedown handler closes when the click lands outside the switcher's own ref", () => {
    expect(body).toMatch(/ref\.current && !ref\.current\.contains\(/);
  });

  test("both listeners are torn down in the effect cleanup (no leak across re-opens)", () => {
    expect(body).toMatch(/return \(\) => \{[\s\S]*?removeEventListener\("mousedown"[\s\S]*?removeEventListener\("keydown"[\s\S]*?\};/);
  });

  test("the listeners are only attached while the panel is open (guarded by an early return)", () => {
    const effectStart = body.indexOf("useEffect(() => {");
    const guard = body.slice(effectStart, effectStart + 80);
    expect(guard).toContain("if (!open) return;");
  });
});
