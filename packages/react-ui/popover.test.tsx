// packages/react-ui/popover.test.tsx — the React dropdown popover (ds/components-popover,
// registry row `popover` v1). React twin of packages/preact-ui/popover.test.tsx.
//
// Three things are proven here:
//  1. RENDER CONTRACT — the closed trigger and (via the hook-free `PopoverPanel`) the open panel
//     emit the design card's markup, with every class/glyph/ARIA attribute equal, verbatim, to
//     what `@mythicalos/ui-core` derives.
//  2. THE SPLIT IS GENUINE — a source scan proving this binding re-implements NONE of the core's
//     decisions: no key names, no role/ARIA literals (not even `aria-hidden` or the divider's
//     `role="separator"`), no glyphs, no class strings in any quote form.
//  3. CROSS-BINDING PARITY — a Preact tree cannot be handed to react-dom/server (parity.test.tsx's
//     standing note), so the two bindings are pinned to the SAME core outputs from both sides, and
//     the two source files are diffed structurally: identical except for the documented
//     React deltas (class→className, hook import, the isomorphic layout-effect alias, ReactNode).
//     If someone edits one binding's markup and not the other, this fails.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_EMPTY_VALUE,
  popoverIds,
  popoverItemClass,
  popoverPanelClass,
  popoverTriggerClass,
  popoverTriggerText,
  type PopoverItem,
} from "@mythicalos/ui-core/logic";
import { Popover } from "./src/index.ts";
import { PopoverPanel } from "./src/Popover.tsx";

const noop = () => {};

const LANES: PopoverItem[] = [
  { key: "codex", label: "codex cross-model", selected: true },
  { key: "clean", label: "clean-context ephemeral" },
  { key: "off", label: "off — no review lane" },
];

const ids = popoverIds("lane");

describe("Popover — closed trigger render contract (the design card's chip)", () => {
  const html = renderToStaticMarkup(<Popover items={LANES} label="review lane:" onSelect={noop} />);

  test("renders the anchor + a real <button> trigger, class verbatim from popoverTriggerClass", () => {
    expect(html).toContain('class="my-pop-anchor"');
    expect(html).toContain(`class="${popoverTriggerClass({ open: false, disabled: false })}"`);
    expect(html).toContain('type="button"');
  });

  test("shows the design card's face: prefix + the SELECTED label + the caret", () => {
    const text = popoverTriggerText(LANES, { label: "review lane:" });
    expect(html).toContain(`>${text.label}</span>`);
    expect(html).toContain(`>${text.value}</span>`);
    expect(html).toContain(POPOVER_CARET);
  });

  test("the caret is decorative, so it is hidden from assistive tech", () => {
    expect(html).toMatch(/class="my-pop-trigger__caret" aria-hidden="true"/);
  });

  test("advertises a menu, is collapsed, and does NOT point at a panel that does not exist", () => {
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("aria-controls");
  });

  test("the panel is genuinely absent when closed (not merely hidden)", () => {
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain("my-pop__item");
  });

  test("no aria-label on the trigger — its visible text IS its accessible name (label-in-name)", () => {
    expect(html).not.toContain("aria-label=");
  });

  test("nothing selected ⇒ the em-dash placeholder, never a fabricated item label", () => {
    const bare = renderToStaticMarkup(<Popover items={[{ key: "a", label: "A" }]} onSelect={noop} />);
    expect(bare).toContain(POPOVER_EMPTY_VALUE);
    expect(bare).not.toContain(">A</span>");
  });

  test("a caller placeholder wins over the em-dash", () => {
    const empty = renderToStaticMarkup(<Popover items={[]} placeholder="no project configured" onSelect={noop} />);
    expect(empty).toContain("no project configured");
  });

  test("disabled ⇒ the native disabled attribute AND the derived is-disabled class", () => {
    const off = renderToStaticMarkup(<Popover items={LANES} disabled onSelect={noop} />);
    expect(off).toContain(`class="${popoverTriggerClass({ open: false, disabled: true })}"`);
    expect(off).toContain("disabled");
  });
});

describe("PopoverPanel — open panel render contract", () => {
  const html = renderToStaticMarkup(
    <PopoverPanel ids={ids} pos={{ placement: "below", align: "start" }} items={LANES} onPick={noop} />,
  );

  test("the visual panel carries no role — the menu is NESTED inside it", () => {
    expect(html).toContain(`id="${ids.panel}"`);
    // the panel's own opening tag, up to its first child, must not claim a role
    const panelTag = html.slice(html.indexOf("<div"), html.indexOf(">") + 1);
    expect(panelTag).toContain(`id="${ids.panel}"`);
    expect(panelTag).not.toContain("role=");
  });

  test("the nested menu owns ONLY the rows, is named by the trigger, and is what aria-controls targets", () => {
    expect(html).toContain('role="menu"');
    expect(html).toContain(`id="${ids.menu}"`);
    expect(html).toContain(`aria-labelledby="${ids.trigger}"`);
    const menu = html.slice(html.indexOf(`id="${ids.menu}"`));
    // rows render no nested <div>, so the FIRST </div> after the menu's tag is the menu's own close
    const menuBody = menu.slice(0, menu.indexOf("</div>"));
    // nothing but menuitemradio buttons between the menu's tags
    expect(menuBody.match(/<button/g)).toHaveLength(LANES.length);
    expect(menuBody.match(/role="menuitemradio"/g)).toHaveLength(LANES.length);
  });

  test("a heading names the menu in place of the trigger, and stays OUTSIDE it", () => {
    const titled = renderToStaticMarkup(
      <PopoverPanel
        ids={ids}
        pos={{ placement: "below", align: "start" }}
        items={LANES}
        title="Switch review lane"
        onPick={noop}
      />,
    );
    expect(titled).toContain(`id="${ids.title}"`);
    expect(titled).toContain(`aria-labelledby="${ids.title}"`);
    expect(titled).not.toContain(`aria-labelledby="${ids.trigger}"`);
    // the heading precedes the menu element, so the menu never owns it
    expect(titled.indexOf(`id="${ids.title}"`)).toBeLessThan(titled.indexOf(`id="${ids.menu}"`));
  });

  test("panel class comes verbatim from popoverPanelClass", () => {
    expect(html).toContain(`class="${popoverPanelClass({ placement: "below", align: "start" })}"`);
  });

  test("the flip/align modifiers are the ONLY thing position changes — no inline styles", () => {
    for (const pos of [
      { placement: "above", align: "start" },
      { placement: "below", align: "end" },
      { placement: "above", align: "end" },
    ] as const) {
      const flipped = renderToStaticMarkup(<PopoverPanel ids={ids} pos={pos} items={LANES} onPick={noop} />);
      expect(flipped).toContain(`class="${popoverPanelClass(pos)}"`);
      expect(flipped).not.toContain("style=");
    }
  });

  test("every row is a menuitemradio carrying aria-checked, class verbatim from popoverItemClass", () => {
    for (const item of LANES) {
      expect(html).toContain(`class="${popoverItemClass(item)}"`);
      expect(html).toContain(item.label);
    }
    expect(html.match(/role="menuitemradio"/g)).toHaveLength(LANES.length);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(2);
  });

  test("✓ marks the current row and only the current row, and is decorative", () => {
    expect(html.match(new RegExp(POPOVER_CHECK, "g"))).toHaveLength(1);
    expect(html).toMatch(/class="my-pop__check" aria-hidden="true"/);
  });

  test("a disabled row is inert natively AND announced as disabled", () => {
    const withDisabled = renderToStaticMarkup(
      <PopoverPanel
        ids={ids}
        pos={{ placement: "below", align: "start" }}
        items={[{ key: "a", label: "A", disabled: true }]}
        onPick={noop}
      />,
    );
    expect(withDisabled).toContain(`class="${popoverItemClass({ disabled: true })}"`);
    expect(withDisabled).toContain('aria-disabled="true"');
    expect(withDisabled).toContain("disabled");
  });

  test("head + footer are optional, and the footer arrives behind a real separator", () => {
    expect(html).not.toContain("my-pop__head");
    expect(html).not.toContain("my-pop__foot");
    const full = renderToStaticMarkup(
      <PopoverPanel
        ids={ids}
        pos={{ placement: "below", align: "start" }}
        items={LANES}
        title="Switch review lane"
        caption="applies to the next run only"
        footer={<button type="button">Manage lanes →</button>}
        onPick={noop}
      />,
    );
    expect(full).toContain("Switch review lane");
    expect(full).toContain("applies to the next run only");
    expect(full).toContain('role="separator"');
    expect(full).toContain("Manage lanes →");
    // a menu may not own arbitrary content: the footer button comes AFTER the menu closes
    expect(full.indexOf("Manage lanes →")).toBeGreaterThan(full.indexOf(`id="${ids.menu}"`));
    const menu = full.slice(full.indexOf(`id="${ids.menu}"`));
    expect(menu.slice(0, menu.indexOf("</div>"))).not.toContain("Manage lanes →");
  });

  test("a conditional footer that renders nothing leaves NO orphan separator or empty box", () => {
    for (const nothing of [undefined, null, false, ""] as const) {
      const html2 = renderToStaticMarkup(
        <PopoverPanel
          ids={ids}
          pos={{ placement: "below", align: "start" }}
          items={LANES}
          footer={nothing}
          onPick={noop}
        />,
      );
      expect(html2).not.toContain("my-pop__div");
      expect(html2).not.toContain("my-pop__foot");
    }
  });

  test("an empty heading builds no head, and never leaves the menu labelled by empty text", () => {
    const blank = renderToStaticMarkup(
      <PopoverPanel ids={ids} pos={{ placement: "below", align: "start" }} items={LANES} title="" onPick={noop} />,
    );
    expect(blank).not.toContain("my-pop__head");
    expect(blank).toContain(`aria-labelledby="${ids.trigger}"`);
    expect(blank).not.toContain(`aria-labelledby="${ids.title}"`);
  });

  test("the panel itself is programmatically focusable — the fallback when no row can take focus", () => {
    expect(html).toContain('tabindex="-1"');
  });

  test("rows are query-addressable for roving focus (the binding's [data-pop-item] hook)", () => {
    expect(html.match(/data-pop-item/g)).toHaveLength(LANES.length);
  });
});

describe("PopoverPanel — the REAL onPick closure (invoked off the element tree, no DOM needed)", () => {
  function rowsOf(tree: ReturnType<typeof PopoverPanel>): any[] {
    // panel children: [head?, menu, footer?] — the rows are the menu element's children.
    const children = (tree as any).props.children as any[];
    const menu = children.find((c) => c && c.props && c.props.role === "menu");
    expect(menu).toBeDefined();
    return menu.props.children as any[];
  }

  test("picking an enabled row hands back the item itself", () => {
    const picked: PopoverItem[] = [];
    const tree = PopoverPanel({
      ids,
      pos: { placement: "below", align: "start" },
      items: LANES,
      onPick: (item) => picked.push(item),
    });
    rowsOf(tree)[1].props.onClick();
    expect(picked).toEqual([LANES[1]!]);
  });

  test("picking a DISABLED row is inert even if a click somehow reaches it", () => {
    const picked: PopoverItem[] = [];
    const tree = PopoverPanel({
      ids,
      pos: { placement: "below", align: "start" },
      items: [{ key: "a", label: "A", disabled: true }],
      onPick: (item) => picked.push(item),
    });
    rowsOf(tree)[0].props.onClick();
    expect(picked).toEqual([]);
  });
});

// ── the split is genuine: this binding decides NOTHING ────────────────────────────────────────
const reactSrc = readFileSync(join(import.meta.dir, "src", "Popover.tsx"), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("ui-core/binding split — no core decision is re-implemented here", () => {
  const code = stripComments(reactSrc);

  test("sanity: the comment stripper leaves real code behind", () => {
    expect(code).toContain("export function Popover");
    expect(code.length).toBeGreaterThan(1000);
  });

  test.each([
    ['"ArrowDown"', "key names belong to popoverTriggerKeyAction/popoverPanelKeyAction"],
    ['"ArrowUp"', "key names belong to the core"],
    ['"Home"', "key names belong to the core"],
    ['"End"', "key names belong to the core"],
    ['"Escape"', "key names belong to the core"],
    ['"Tab"', "key names belong to the core"],
    ['"menuitemradio"', "row role belongs to popoverItemAria"],
    ['"menu"', "panel role / haspopup belong to popoverPanelAria + popoverTriggerAria"],
    ['"aria-haspopup"', "trigger ARIA belongs to popoverTriggerAria"],
    ['"aria-checked"', "row ARIA belongs to popoverItemAria"],
    ['aria-hidden', "decoration marking belongs to POPOVER_DECORATIVE_ARIA"],
    ['"separator"', "the divider's role belongs to POPOVER_SEPARATOR_ARIA"],
    ["▾", "the caret glyph belongs to POPOVER_CARET"],
    ["✓", "the check glyph belongs to POPOVER_CHECK"],
    ["is-selected", "state modifiers belong to popoverItemClass"],
    ["getBoundingClientRect().bottom", "the flip arithmetic belongs to resolvePopoverPlacement"],
  ])("the binding source contains no %s (%s)", (needle) => {
    expect(code).not.toContain(needle);
  });

  // ── generic guards, not a denylist ───────────────────────────────────────────────────────────
  // A denylist can only catch the literals someone thought of. These three match ANY quote form
  // (", ' or backtick), ANYWHERE inside the literal, and any aria-/role attribute whatsoever — so a
  // NEW core-owned literal, or a class smuggled in as `"x my-pop__item"`, fails too.

  /** A quoted literal that CONTAINS `needle` anywhere. */
  const quoted = (needle: string) => new RegExp(`["'\`][^"'\`]*${needle}[^"'\`]*["'\`]`);

  /** Every token this binding must never spell out for itself. */
  const CORE_OWNED = [
    "my-pop", // class names → POPOVER_CLASS
    "ArrowDown",
    "ArrowUp",
    "Home",
    "End",
    "Escape",
    "Tab", // key names → popoverTriggerKeyAction / popoverPanelKeyAction
    "menuitem",
    "haspopup",
    "separator", // roles → popoverItemAria / popoverMenuAria / POPOVER_SEPARATOR_ARIA
    "▾",
    "✓", // glyphs → POPOVER_CARET / POPOVER_CHECK
  ];

  test("the generic guards themselves catch what a denylist would miss (negative fixtures)", () => {
    // every quote form
    expect(quoted("ArrowDown").test(`if (e.key === 'ArrowDown')`)).toBe(true);
    expect(quoted("ArrowDown").test("if (e.key === `ArrowDown`)")).toBe(true);
    expect(quoted("ArrowDown").test('if (e.key === "ArrowDown")')).toBe(true);
    // a class smuggled in as part of a longer literal
    expect(quoted("my-pop").test('class="x my-pop__item"')).toBe(true);
    // an ARIA attribute nobody put on a denylist
    expect(/\baria-[a-zA-Z-]+\s*=/.test('<span aria-describedby="x" />')).toBe(true);
    expect(/\brole\s*=/.test('<div role="group" />')).toBe(true);
    // and they do NOT fire on the real, core-sourced forms
    expect(quoted("my-pop").test("class={POPOVER_CLASS.item}")).toBe(false);
    expect(/\baria-[a-zA-Z-]+\s*=/.test("{...popoverItemAria(item)}")).toBe(false);
  });

  test.each(CORE_OWNED)("no literal in ANY quote form contains %s", (needle) => {
    expect(quoted(needle).test(code)).toBe(false);
  });

  test("NOT ONE aria-* or role attribute is authored here — they arrive only by spreading core maps", () => {
    expect(code).not.toMatch(/\baria-[a-zA-Z-]+\s*=/);
    expect(code).not.toMatch(/\brole\s*=/);
    expect(code).toContain("POPOVER_CLASS.");
  });

  test("it imports the decisions it needs instead", () => {
    for (const symbol of [
      "popoverTriggerClass",
      "popoverPanelClass",
      "popoverItemClass",
      "popoverTriggerAria",
      "popoverPanelAria",
      "popoverMenuAria",
      "POPOVER_DECORATIVE_ARIA",
      "POPOVER_SEPARATOR_ARIA",
      "popoverItemAria",
      "popoverTriggerKeyAction",
      "popoverPanelKeyAction",
      "popoverKeyHandled",
      "popoverAppliesToFocus",
      "resolvePopoverIndex",
      "resolvePopoverPosition",
      "samePopoverPosition",
      "initialPopoverIndex",
      "edgePopoverIndex",
      "popoverTriggerText",
      "popoverIds",
      "popoverHasSlotContent",
      "POPOVER_CLASS",
    ]) {
      expect(code).toContain(symbol);
    }
    expect(code).toContain('from "@mythicalos/ui-core/logic"');
  });
});

describe("DOM wiring — proven by source scan, since effects never run under server rendering", () => {
  test("outside pointerdown closes the popover (capture phase, and it is cleaned up)", () => {
    expect(reactSrc).toContain('document.addEventListener("pointerdown", onDown, true)');
    expect(reactSrc).toContain('document.removeEventListener("pointerdown", onDown, true)');
    expect(reactSrc).toContain("anchorRef.current.contains(e.target as Node)");
  });

  test("placement is re-measured on resize AND on scroll, and both listeners are removed", () => {
    expect(reactSrc).toContain('window.addEventListener("resize", measure)');
    expect(reactSrc).toContain('window.removeEventListener("resize", measure)');
    expect(reactSrc).toContain('document.addEventListener("scroll", measure, { capture: true, passive: true })');
    expect(reactSrc).toContain('document.removeEventListener("scroll", measure, { capture: true })');
  });

  test("measurement runs before paint in the BROWSER, via the isomorphic alias (no SSR warning)", () => {
    expect(reactSrc).toContain("useIsomorphicLayoutEffect");
    expect(reactSrc).toContain('typeof document === "undefined" ? useEffect : useLayoutEffect');
  });

  test("Escape and selecting BOTH return focus to the trigger — never stranded on <body>", () => {
    expect(reactSrc).toMatch(
      /const closeToTrigger = \(\) => \{\s*setOpenState\(false\);\s*triggerRef\.current\?\.focus/,
    );
    expect(reactSrc).toContain("closeToTrigger(); // a11y — selecting returns focus to the trigger");
  });

  test("every programmatic focus uses preventScroll (a bare focus() scrolls the page out of view)", () => {
    const focusCalls = reactSrc.match(/\.focus\([^)]*\)/g) ?? [];
    expect(focusCalls.length).toBeGreaterThan(0);
    for (const call of focusCalls) expect(call).toContain("preventScroll: true");
  });

  test("roving keys are gated on the focused element being a row or the panel, not the footer", () => {
    expect(reactSrc).toContain("popoverAppliesToFocus(action, onRovingSurface)");
    expect(reactSrc).toMatch(/const onRovingSurface = focused >= 0 \|\| document\.activeElement === panelRef\.current;/);
    // the gate must come BEFORE any preventDefault, or a footer input still loses the keystroke
    expect(reactSrc.indexOf("popoverAppliesToFocus")).toBeLessThan(reactSrc.indexOf("e.preventDefault();\n    if (action ==="));
  });

  test("focus moves INTO the menu on open, at the index the core picks", () => {
    expect(reactSrc).toContain("initialPopoverIndex(items)");
    expect(reactSrc).toContain("panelRef.current?.focus({ preventScroll: true })");
  });
});

// ── cross-binding parity ──────────────────────────────────────────────────────────────────────
describe("parity with @mythicalos/preact-ui — the two bindings cannot drift", () => {
  const preactSrc = readFileSync(
    join(import.meta.dir, "..", "preact-ui", "src", "Popover.tsx"),
    "utf8",
  );

  /** Normalize away the DOCUMENTED React deltas; everything left must match byte for byte. */
  function normalize(src: string): string {
    return stripComments(src)
      // the React-only alias declaration goes first — after it, the two files must agree
      .replace(
        /const useIsomorphicLayoutEffect = typeof document === "undefined" \? useEffect : useLayoutEffect;/g,
        "",
      )
      .replace(/useIsomorphicLayoutEffect/g, "useLayoutEffect")
      .replace(/className=/g, "class=")
      .replace(/ReactNode/g, "ComponentChildren")
      .replace(/ReactKeyboardEvent<HTMLDivElement>/g, "KeyboardEvent")
      .replace(/import \{[^}]*\} from "(preact\/hooks|react)";/g, "IMPORT_HOOKS")
      .replace(/import type \{[^}]*\} from "(preact|react)";/g, "IMPORT_TYPES")
      .replace(/\s+/g, " ")
      .trim();
  }

  test("the two binding sources are identical once the documented React deltas are normalized", () => {
    expect(normalize(reactSrc)).toBe(normalize(preactSrc));
  });

  test("both bindings expose the same public prop surface", () => {
    const propsOf = (src: string) =>
      (src.match(/export interface PopoverProps \{([\s\S]*?)\n\}/)?.[1] ?? "")
        .split("\n")
        .map((l) => l.trim().match(/^(\w+)\??:/)?.[1])
        .filter(Boolean)
        .sort();
    const reactProps = propsOf(reactSrc);
    expect(reactProps.length).toBeGreaterThan(5);
    expect(reactProps).toEqual(propsOf(preactSrc));
  });

  test("both barrels export the same popover symbols", () => {
    const block = (pkg: string) =>
      readFileSync(join(import.meta.dir, "..", pkg, "src", "index.ts"), "utf8")
        .match(/\/\/ ── dropdown popover[\s\S]*?\} from "\.\/Popover\.js";/)?.[0] ?? "";
    expect(block("react-ui")).not.toBe("");
    expect(block("react-ui")).toBe(block("preact-ui"));
  });
});
