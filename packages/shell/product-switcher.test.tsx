/** @jsxImportSource preact */
// packages/shell/product-switcher.test.tsx — ProductSwitcher, the flagship central module.
// Render contract + the pure click-routing decision.
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
//      The two are joined end to end by calling the hook-free `SwitcherPanel` as a plain function
//      and invoking a row's REAL `onPick` closure off the returned vnode tree (see `panelRows`
//      below) — the technique nav-tabs.test.tsx / workspace.test.tsx already use. That runs the
//      shipped click path; only the browser's event dispatch is missing.
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
import type { VNode } from "preact";
import { ASGARD, PRODUCTS, ProductSwitcher, type Product } from "./src/index.ts";
import {
  COMMAND_CENTER_LABEL,
  CURRENT_ROLE_SUFFIX,
  resolveSwitcherPick,
  SwitcherPanel,
  type ResolveSwitcherPickHandlers,
  type SwitcherPickResult,
  type SwitcherPanelProps,
} from "./src/ProductSwitcher.tsx";

const noop = () => {};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** A panel row vnode, with the real closure the shipped component attached to it. */
type RowVNode = VNode<{ product: Product; onPick: () => void; role: string; isCurrent: boolean }>;

/**
 * Every row of the panel, in document order, as REAL vnodes carrying their real `onPick`
 * closures. `SwitcherPanel` uses no hooks, so calling it as a plain function (not through
 * h()/render()) hands back the tree preact would have built — the same technique
 * nav-tabs.test.tsx and workspace.test.tsx use to reach un-clickable handlers without a DOM.
 */
function panelRows(props: SwitcherPanelProps): RowVNode[] {
  const panel = (SwitcherPanel as unknown as (p: SwitcherPanelProps) => VNode)(props);
  const rows: RowVNode[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const n of node) walk(n);
      return;
    }
    if (!node || typeof node !== "object") return;
    const props = (node as { props?: Record<string, unknown> }).props;
    if (!props || typeof props !== "object") return;
    if ("product" in props && "onPick" in props) {
      rows.push(node as RowVNode);
      return;
    }
    walk(props["children"]);
  };
  walk(panel);
  return rows;
}

/** The rows rendered from the `products` list, in order. */
function productRows(props: SwitcherPanelProps): RowVNode[] {
  return panelRows(props).slice(0, props.products.length);
}

/** The command-center row — the one below the "command center" label. */
function commandCenterRow(props: SwitcherPanelProps): RowVNode {
  const rows = panelRows(props);
  expect(rows.length).toBe(props.products.length + 1);
  return rows[rows.length - 1]!;
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

  // ── the mark is the product you are in (design source: every logo slot renders the current
  //    product's glyph) ──────────────────────────────────────────────────────────────────────
  test("the trigger's mark is the CURRENT product's glyph, not a generic family mark", () => {
    const brokkr = renderToString(<ProductSwitcher current="brokkr" />);
    const skuld = renderToString(<ProductSwitcher current="skuld" />);
    const saga = renderToString(<ProductSwitcher current="saga" />);
    // each product's own glyph art, taken from ProductGlyph's registry
    expect(brokkr).toContain('x="28" y="24" width="34" height="17"'); // brokkr's hammer head
    expect(skuld).toContain("M10 24c26 0 34 20 46 23"); // skuld's spun thread
    expect(saga).toContain('cx="44" cy="22"'); // saga's scroll/volume ellipse
    // and never each other's
    expect(brokkr).not.toContain("M10 24c26 0 34 20 46 23");
    expect(skuld).not.toContain('x="28" y="24" width="34" height="17"');
  });

  test("the trigger's mark renders at the design source's 30px logo-slot size", () => {
    const html = renderToString(<ProductSwitcher current="brokkr" />);
    expect(html).toContain('width="30" height="30"');
  });

  test("a current key with no registered glyph art still renders a mark — never a hole in the top bar", () => {
    const html = renderToString(<ProductSwitcher current="nonexistent" />);
    expect(html).toContain("my-logo__mark");
    expect(html).toContain("M48 204V72L128 152L208 72V168"); // the generic family mark, as fallback
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
    expect(menuitemCount).toBe(PRODUCTS.length + 1); // + the command-center (ASGARD) row
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

  test("every shipped product gets the online dot — none of them is dressed as unbuilt", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="note text" onPick={noop} />,
    );
    const online = (html.match(/my-switcher__dot--online/g) ?? []).length;
    expect(online).toBe(PRODUCTS.length - 1); // all but the current one, which is "here"
  });

  // ── the current row's role carries the "this container" suffix; no other row does ──────────
  test("the current product's role line gets the ' · this container' suffix", () => {
    const html = renderToString(
      <SwitcherPanel current="skuld" products={PRODUCTS} note="n" onPick={noop} />,
    );
    const skuld = PRODUCTS.find((p) => p.key === "skuld")!;
    expect(html).toContain(
      `${skuld.role.replace(/&/g, "&amp;")}${CURRENT_ROLE_SUFFIX}</span>`,
    );
  });

  test("the suffix follows `current` — every other row keeps its bare registry role", () => {
    const html = renderToString(
      <SwitcherPanel current="skuld" products={PRODUCTS} note="n" onPick={noop} />,
    );
    // exactly one row is suffixed, no matter which product is current
    expect((html.match(/ · this container/g) ?? []).length).toBe(1);
    for (const p of PRODUCTS) {
      if (p.key === "skuld") continue;
      expect(html).toContain(`${p.role.replace(/&/g, "&amp;")}</span>`);
    }
  });

  test("the suffix moves with `current` rather than being pinned to one product", () => {
    for (const cur of PRODUCTS) {
      const html = renderToString(
        <SwitcherPanel current={cur.key} products={PRODUCTS} note="n" onPick={noop} />,
      );
      expect(html).toContain(
        `${cur.role.replace(/&/g, "&amp;")}${CURRENT_ROLE_SUFFIX}</span>`,
      );
    }
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

describe("SwitcherPanel — the command-center section (design source: divider + label + ASGARD row)", () => {
  const html = renderToString(
    <SwitcherPanel current="brokkr" products={PRODUCTS} note={ASGARD.role} onPick={noop} />,
  );

  test("renders the divider, then the 'command center' section label", () => {
    expect(html).toContain("my-switcher__divider");
    expect(html).toContain(`<div class="my-switcher__section">${COMMAND_CENTER_LABEL}</div>`);
    expect(html.indexOf("my-switcher__divider")).toBeLessThan(html.indexOf("my-switcher__section"));
  });

  test("the ASGARD row uses the same markup shape as a product row, below the label", () => {
    const at = html.indexOf("my-switcher__section");
    const tail = html.slice(at);
    expect(tail).toContain("my-switcher__item");
    expect(tail).toContain("my-switcher__mark");
    expect(tail).toContain("my-switcher__body");
    expect(tail).toContain("ASGARD");
    expect(tail).toContain("Cross-family command center");
    expect(tail).toContain("my-switcher__dot");
  });

  test("the row is a menuitem — the panel's menuitem count is products + the command-center row", () => {
    expect((html.match(/role="menuitem"/g) ?? []).length).toBe(PRODUCTS.length + 1);
  });

  test("no 'here' badge on the command-center row (the design source has none)", () => {
    const tail = html.slice(html.indexOf("my-switcher__section"));
    expect(tail).not.toContain("my-switcher__here");
    expect(tail).not.toContain("is-current");
  });

  test("honesty deviation: the row ships the NOT-BUILT dot, never the design source's online dot", () => {
    const tail = html.slice(html.indexOf("my-switcher__section"));
    expect(tail).toContain("my-switcher__dot--soon");
    expect(tail).not.toContain("my-switcher__dot--online");
  });

  test("it is the only not-yet-built dot in the panel — no shipped product wears one", () => {
    expect((html.match(/my-switcher__dot--soon/g) ?? []).length).toBe(1);
  });

  test("the row's secondary line is the `note` prop, so a caller's value is never silently dropped", () => {
    const custom = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="custom note copy" onPick={noop} />,
    );
    expect(custom).toContain("custom note copy");
  });

  // The click path, executed for real. `SwitcherPanel` is hook-free, so calling it as a plain
  // function hands back the actual vnode tree with the actual onPick closures attached — the same
  // technique nav-tabs.test.tsx / workspace.test.tsx use. Invoking the command-center row's own
  // closure runs the shipped code path, not a reconstruction of it.
  test("invoking the command-center row's real onPick closure hands over the ASGARD entry", () => {
    let picked: Product | undefined;
    const row = commandCenterRow({
      current: "brokkr",
      products: PRODUCTS,
      note: ASGARD.role,
      onPick: (p) => (picked = p),
    });
    row.props.onPick();
    expect(picked).toBe(ASGARD);
  });

  test("that closure, wired to the shipped routing decision, ends in onUnbuilt — never a navigation, real or faked", () => {
    let unbuilt: Product | undefined;
    let navigated = false;
    // exactly what ProductSwitcher's own `pick` does with the product the row hands it
    const row = commandCenterRow({
      current: "brokkr",
      products: PRODUCTS,
      note: ASGARD.role,
      onPick: (p) =>
        resolveSwitcherPick(p, "brokkr", {
          onNavigate: () => (navigated = true),
          onUnbuilt: (u) => (unbuilt = u),
        }),
    });
    row.props.onPick();
    expect(unbuilt).toBe(ASGARD);
    expect(navigated).toBe(false);
  });

  test("a product row's closure hands over that product — the rows are not cross-wired", () => {
    const rows = productRows({ current: "brokkr", products: PRODUCTS, note: "n", onPick: () => {} });
    expect(rows.length).toBe(PRODUCTS.length);
    for (const [i, p] of PRODUCTS.entries()) {
      let picked: Product | undefined;
      const row = productRows({
        current: "brokkr",
        products: PRODUCTS,
        note: "n",
        onPick: (q) => (picked = q),
      })[i]!;
      row.props.onPick();
      expect(picked).toBe(p);
    }
  });

  test("the row is inert at render time — nothing fires onPick during a render", () => {
    let picked: Product | undefined;
    renderToString(
      <SwitcherPanel
        current="brokkr"
        products={PRODUCTS}
        note={ASGARD.role}
        onPick={(p) => (picked = p)}
      />,
    );
    expect(picked).toBeUndefined();
  });

  test("the panel no longer renders the retired prose footer note", () => {
    expect(html).not.toContain("my-switcher__note");
    expect(html).not.toContain("arrives later");
  });
});

describe("resolveSwitcherPick — the pure click-routing decision (no DOM required)", () => {
  const brokkr = PRODUCTS.find((p) => p.key === "brokkr")!;
  const saga = PRODUCTS.find((p) => p.key === "saga")!; // ships and runs: online, navigable

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

  test("a 'soon' / href-less entry calls onUnbuilt, never onNavigate", () => {
    let navigated = false;
    let unbuiltProduct: Product | undefined;
    const result = resolveSwitcherPick(ASGARD, "brokkr", {
      onNavigate: () => (navigated = true),
      onUnbuilt: (p) => (unbuiltProduct = p),
    });
    expect(result.action).toBe("unbuilt");
    expect(navigated).toBe(false);
    expect(unbuiltProduct).toBe(ASGARD);
  });

  // ── saga ships: a click must reach the consumer's onNavigate (where its live probe runs),
  //    not be short-circuited into "isn't built yet" ────────────────────────────────────────
  test("saga routes to onNavigate — the consumer's live resolver gets to run", () => {
    let unbuilt = false;
    let navigatedTo: Product | undefined;
    const result = resolveSwitcherPick(saga, "brokkr", {
      onNavigate: (p) => (navigatedTo = p),
      onUnbuilt: () => (unbuilt = true),
    });
    expect(result.action).toBe("navigate-handled");
    expect(navigatedTo).toBe(saga);
    expect(unbuilt).toBe(false);
  });

  test("every registry product routes to onNavigate from every other product's menu", () => {
    for (const from of PRODUCTS) {
      for (const to of PRODUCTS) {
        if (to.key === from.key) continue;
        let unbuilt = false;
        const result = resolveSwitcherPick(to, from.key, {
          onNavigate: () => {},
          onUnbuilt: () => (unbuilt = true),
        });
        expect(result.action).toBe("navigate-handled");
        expect(unbuilt).toBe(false);
      }
    }
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

  // The rows' closures are proven above by direct invocation; what a DOM-free test cannot reach is
  // the seam between them and the stateful component — that <SwitcherPanel onPick={pick}> really
  // is the panel it renders, and that `pick` really is the shipped routing decision.
  test("the panel it renders is handed the component's own `pick` as onPick", () => {
    expect(body).toMatch(/<SwitcherPanel[^>]*onPick=\{pick\}/s);
  });

  test("`pick` routes through resolveSwitcherPick, and only navigates on that decision's say-so", () => {
    const pickStart = body.indexOf("const pick =");
    expect(pickStart).toBeGreaterThan(-1);
    const pickBody = body.slice(pickStart, body.indexOf("return (", pickStart));
    expect(pickBody).toContain("resolveSwitcherPick(p, current, { onNavigate, onUnbuilt })");
    expect(pickBody).toMatch(/result\.action === "navigate-href"/);
    expect(pickBody).toMatch(/window\.location\.href = result\.href/);
  });
});

describe("product glyphs — the navigation marks (product-navigation reference)", () => {
  test("every registry product renders an svg glyph mark, not its initial letter", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="n" onPick={noop} />,
    );
    // one glyph per product row + one for the command-center (ASGARD) row
    const glyphCount = (html.match(/class="my-glyph"/g) ?? []).length;
    expect(glyphCount).toBe(PRODUCTS.length + 1);
    for (const p of PRODUCTS) expect(html).not.toContain(`>${p.initial}</span>`);
  });

  test("glyphs are token-colored (theme-aware), never hardcoded hex", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="n" onPick={noop} />,
    );
    expect(html).toContain("var(--my-ink)");
    expect(html).toContain("var(--my-accent)");
    expect(html).not.toMatch(/#(16181D|0F6B66|ECE7DE|3FB8AE)/i);
  });

  test("the command-center row carries the asgard glyph (the arch), not a text glyph", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="n" onPick={noop} />,
    );
    expect(html).toContain("M12 53C12 17 84 17 84 53"); // the bifröst arch path
    expect(html).not.toContain("✦");
  });

  test("the command-center row's mark is a 32px tile holding the glyph at the row size (20px), same as a product row", () => {
    const html = renderToString(
      <SwitcherPanel current="brokkr" products={PRODUCTS} note="n" onPick={noop} />,
    );
    const tail = html.slice(html.indexOf("my-switcher__section"));
    expect(tail).toContain('class="my-switcher__mark"');
    expect(tail).toContain('width="20" height="20"'); // the tile itself is 32px, in styles.css
    expect((html.match(/width="20" height="20"/g) ?? []).length).toBe(PRODUCTS.length + 1);
  });

  test("a custom product key without registered art falls back to the initial letter", () => {
    const custom: Product[] = [
      { key: "x", name: "XPROD", initial: "X", role: "r", href: "/x", state: "online" },
    ];
    const html = renderToString(<SwitcherPanel current="x" products={custom} note="n" onPick={noop} />);
    expect(html).not.toContain("my-glyph\" viewBox"); // no art for "x"… 
    expect(html).toContain(">X</span>"); // …so the mark is the initial
  });
});


// ── Product.version — the consumer's own reading, rendered at the row's top right ──────────────
// `version` is optional and the registry ships none, so the default rendering of every existing
// consumer is unchanged; these pin both halves of that contract.
/**
 * Inner HTML of the first element carrying `cls`, tracking nested `<span>` depth so that "inside"
 * means genuinely inside. Serialized-string ordering cannot distinguish a child from a later
 * sibling, which is the whole point of the placement pin below.
 */
function innerHtmlOf(html: string, cls: string): string {
  const open = html.indexOf(`<span class="${cls}"`);
  if (open === -1) return "";
  const start = html.indexOf(">", open) + 1;
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<span", i);
    const nextClose = html.indexOf("</span>", i);
    if (nextClose === -1) return "";
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + "<span".length;
    } else {
      depth--;
      if (depth === 0) return html.slice(start, nextClose);
      i = nextClose + "</span>".length;
    }
  }
  return "";
}

describe("SwitcherRow — the optional per-product version", () => {
  const withVersion = (version?: string): Product[] => [
    { key: "x", name: "XPROD", initial: "X", role: "r", href: "/x", state: "online", ...(version === undefined ? {} : { version }) },
  ];

  test("a row renders the version the consumer supplied", () => {
    const html = renderToString(
      <SwitcherPanel current="x" products={withVersion("0.1.40")} note="n" onPick={noop} />,
    );
    expect(html).toContain('class="my-switcher__version"');
    expect(html).toContain("0.1.40");
  });

  test("the version is a CHILD of the name line — that is what puts it top-right", () => {
    // Position is the requirement, not mere presence: the name line is the row's first line and the
    // status dot sits outside the body, so a version rendered INSIDE the name line lands at the top
    // right just inboard of the dot.
    //
    // Ordering by `indexOf` is not enough to prove that: "version class appears before
    // role class" also holds when the version is a SIBLING between the two spans, where
    // `margin-left:auto` no longer positions it on the name line at all. So the name element's own
    // inner HTML is extracted with balanced-span tracking and the version must be in there.
    const html = renderToString(
      <SwitcherPanel current="x" products={withVersion("9.9.9")} note="n" onPick={noop} />,
    );
    const nameInner = innerHtmlOf(html, "my-switcher__name");
    expect(nameInner).toContain("my-switcher__version");
    expect(nameInner).toContain("9.9.9");
    // …and the extractor really is scoped: the role line is a SIBLING, so it must NOT be in there.
    // Without this, a helper that silently returned the whole document would satisfy the assertions
    // above while proving nothing.
    expect(nameInner).not.toContain("my-switcher__role");
  });

  test("a product with NO version renders no version element — absence is not a blank", () => {
    const html = renderToString(
      <SwitcherPanel current="x" products={withVersion()} note="n" onPick={noop} />,
    );
    expect(html).not.toContain("my-switcher__version");
  });

  test("an EMPTY version string is absence, not an empty badge", () => {
    const html = renderToString(
      <SwitcherPanel current="x" products={withVersion("")} note="n" onPick={noop} />,
    );
    expect(html).not.toContain("my-switcher__version");
  });

  test("the packaged registry ships NO versions — a version is the consumer's reading, not family data", () => {
    for (const p of PRODUCTS) expect(p.version).toBeUndefined();
    expect(ASGARD.version).toBeUndefined();
  });

  test("the published stylesheet defines the class the row references, with the rules that position it", () => {
    // The component names a class; if the sheet does not define it, the version ships unstyled —
    // inheriting the name line's bold, which is the one thing the rule exists to prevent.
    //
    // Bound to the RULE BLOCK, not to the file: the class name also appears in the
    // comment above the rule, so a bare `toContain` would still pass if the selector were deleted
    // and the prose left behind, and a bare `toContain("margin-left: auto")` would match that
    // declaration anywhere in a 22KB sheet. Comments are stripped and the block is matched, so both
    // declarations must genuinely belong to this selector.
    const css = readFileSync(join(import.meta.dir, "styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = css.match(/\.my-switcher__version\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    const body = rule![1]!;
    expect(body).toContain("margin-left: auto"); // what puts it at the right of the name line
    expect(body).toContain("min-width: 0"); // what lets a long reading truncate instead of overflow
    expect(body).toContain("text-overflow: ellipsis");
  });
});
