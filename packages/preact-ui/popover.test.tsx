/** @jsxImportSource preact */
// packages/preact-ui/popover.test.tsx — the dropdown popover binding (ds/components-popover,
// registry row `popover` v1).
//
// Two things are proven here, and they are different things:
//  1. RENDER CONTRACT — the closed trigger and (via the hook-free `PopoverPanel`) the open panel
//     emit exactly the markup the design card describes, with every class/glyph/ARIA attribute
//     equal, verbatim, to what `@mythicalos/ui-core` derives.
//  2. THE SPLIT IS GENUINE — a source scan proving this binding re-implements NONE of the core's
//     decisions: no key names, no role/ARIA literals (not even `aria-hidden` or the divider's
//     `role="separator"`), no glyphs, no class strings in any quote form. If someone
//     later inlines "ArrowDown" or "✓" here, the React sibling silently diverges — this catches it.
//
// `preact-render-to-string` never runs effects or dispatches events, so the DOM wiring itself
// (pointerdown/resize/scroll listeners, focus moves) is covered by the same source-scan technique
// the shell's product-switcher.test.tsx uses for exactly this reason.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
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
  const html = renderToString(<Popover items={LANES} label="review lane:" onSelect={noop} />);

  test("renders the anchor + a real <button> trigger, class verbatim from popoverTriggerClass", () => {
    expect(html).toContain('class="my-pop-anchor"');
    expect(html).toContain(`class="${popoverTriggerClass({ open: false, disabled: false })}"`);
    expect(html).toContain('type="button"');
  });

  test("shows the design card's face: prefix + the SELECTED label + the caret", () => {
    const text = popoverTriggerText(LANES, { label: "review lane:" });
    expect(html).toContain(`>${text.label}</span>`);
    expect(html).toContain(`>${text.value}</span>`);
    expect(html).toContain("codex cross-model");
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
    const bare = renderToString(<Popover items={[{ key: "a", label: "A" }]} onSelect={noop} />);
    expect(bare).toContain(POPOVER_EMPTY_VALUE);
    expect(bare).not.toContain(">A</span>");
  });

  test("a caller placeholder wins over the em-dash", () => {
    const empty = renderToString(<Popover items={[]} placeholder="no project configured" onSelect={noop} />);
    expect(empty).toContain("no project configured");
  });

  test("disabled ⇒ the native disabled attribute AND the derived is-disabled class", () => {
    const off = renderToString(<Popover items={LANES} disabled onSelect={noop} />);
    expect(off).toContain(`class="${popoverTriggerClass({ open: false, disabled: true })}"`);
    expect(off).toContain("disabled");
  });
});

describe("PopoverPanel — open panel render contract", () => {
  const html = renderToString(
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
    const titled = renderToString(
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
      const flipped = renderToString(<PopoverPanel ids={ids} pos={pos} items={LANES} onPick={noop} />);
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
    const withDisabled = renderToString(
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
    const full = renderToString(
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

  test("the panel itself is programmatically focusable — the fallback when no row can take focus", () => {
    expect(html).toContain('tabindex="-1"');
  });

  test("rows are query-addressable for roving focus (the binding's [data-pop-item] hook)", () => {
    expect(html.match(/data-pop-item/g)).toHaveLength(LANES.length);
  });
});

describe("PopoverPanel — the REAL onPick closure (invoked off the vnode tree, no DOM needed)", () => {
  function rowsOf(tree: ReturnType<typeof PopoverPanel>): any[] {
    // panel children: [head?, menu, footer?] — the rows are the menu element's children.
    const children = (tree as any).props.children as any[];
    const menu = children.find((c) => c && c.props && c.props.role === "menu");
    expect(menu).toBeDefined();
    return menu.props.children as any[];
  }

  test("picking an enabled row hands back its key and the item itself", () => {
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
    const items: PopoverItem[] = [{ key: "a", label: "A", disabled: true }];
    const tree = PopoverPanel({
      ids,
      pos: { placement: "below", align: "start" },
      items,
      onPick: (item) => picked.push(item),
    });
    rowsOf(tree)[0].props.onClick();
    expect(picked).toEqual([]);
  });
});

// ── the split is genuine: this binding decides NOTHING ────────────────────────────────────────
describe("ui-core/binding split — no core decision is re-implemented here", () => {
  const src = readFileSync(join(import.meta.dir, "src", "Popover.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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

  // every quote form, not just double — a single-quoted or templated class must fail too
  const CLASS_LITERAL = /["'`]my-[^"'`]*["'`]/g;

  test("the class-literal guard itself catches EVERY quote form (negative fixtures)", () => {
    for (const bad of ['class="my-pop__item"', "class='my-pop__item'", "class={`my-pop__item`}"]) {
      expect(bad.match(CLASS_LITERAL)).not.toBeNull();
    }
    expect('class={POPOVER_CLASS.item}'.match(CLASS_LITERAL)).toBeNull();
  });

  test("NO class-name string literal is inlined at all — every class comes from POPOVER_CLASS", () => {
    expect(code.match(CLASS_LITERAL)).toBeNull();
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
      "resolvePopoverIndex",
      "resolvePopoverPosition",
      "samePopoverPosition",
      "initialPopoverIndex",
      "edgePopoverIndex",
      "popoverTriggerText",
      "popoverIds",
      "POPOVER_CLASS",
    ]) {
      expect(code).toContain(symbol);
    }
    expect(code).toContain('from "@mythicalos/ui-core/logic"');
  });
});

// ── DOM wiring that render-to-string cannot execute (see the shell's product-switcher precedent) ─
describe("DOM wiring — proven by source scan, since effects never run under render-to-string", () => {
  const src = readFileSync(join(import.meta.dir, "src", "Popover.tsx"), "utf8");

  test("outside pointerdown closes the popover (capture phase, and it is cleaned up)", () => {
    expect(src).toContain('document.addEventListener("pointerdown", onDown, true)');
    expect(src).toContain('document.removeEventListener("pointerdown", onDown, true)');
    expect(src).toContain("anchorRef.current.contains(e.target as Node)");
  });

  test("placement is re-measured on resize AND on scroll, and both listeners are removed", () => {
    expect(src).toContain('window.addEventListener("resize", measure)');
    expect(src).toContain('window.removeEventListener("resize", measure)');
    expect(src).toContain('document.addEventListener("scroll", measure, { capture: true, passive: true })');
    expect(src).toContain('document.removeEventListener("scroll", measure, { capture: true })');
  });

  test("measurement runs BEFORE paint, so the panel never flashes at the wrong end", () => {
    expect(src).toContain("useLayoutEffect");
  });

  test("Escape and selecting BOTH return focus to the trigger — never stranded on <body>", () => {
    expect(src).toMatch(/const closeToTrigger = \(\) => \{\s*setOpenState\(false\);\s*triggerRef\.current\?\.focus/);
    expect(src).toContain("closeToTrigger(); // a11y — selecting returns focus to the trigger");
  });

  test("every programmatic focus uses preventScroll (a bare focus() scrolls the page out of view)", () => {
    const focusCalls = src.match(/\.focus\([^)]*\)/g) ?? [];
    expect(focusCalls.length).toBeGreaterThan(0);
    for (const call of focusCalls) expect(call).toContain("preventScroll: true");
  });

  test("focus moves INTO the menu on open, at the index the core picks", () => {
    expect(src).toContain("initialPopoverIndex(items)");
    expect(src).toContain("panelRef.current?.focus({ preventScroll: true })"); // all-disabled fallback
  });
});
