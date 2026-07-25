// test/logic/popover.test.ts — the dropdown popover's PURE core (ds/components-popover, registry
// row `popover` v1). Everything the component decides lives in src/logic/popover.ts precisely so it
// can be proven here, DOM-free, once — instead of twice over two framework bindings that
// render-to-string can't drive past their first frame anyway.
//
// Coverage: viewport-aware flip/align geometry (incl. the "fits neither side" and exact-boundary
// cases), class derivation, the ARIA maps, the keyboard grammar, roving-focus arithmetic that
// skips disabled rows and wraps, trigger text composition, and a check that every class this logic
// emits actually has a selector in the package's stylesheet.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POPOVER_BREATHING_PX,
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_CLASS,
  POPOVER_DEFAULT_POSITION,
  POPOVER_EMPTY_VALUE,
  POPOVER_GAP_PX,
  edgePopoverIndex,
  initialPopoverIndex,
  popoverIds,
  popoverItemAria,
  popoverItemClass,
  popoverKeyHandled,
  popoverMenuAria,
  popoverPanelAria,
  popoverPanelClass,
  popoverPanelKeyAction,
  popoverTriggerAria,
  popoverTriggerClass,
  popoverTriggerKeyAction,
  popoverTriggerText,
  resolvePopoverAlign,
  resolvePopoverIndex,
  resolvePopoverPlacement,
  resolvePopoverPosition,
  samePopoverPosition,
  stepPopoverIndex,
  type PopoverItem,
  type PopoverPanelKeyAction,
} from "../../src/logic/popover.ts";

const VIEWPORT = { width: 800, height: 600 };
/** A 110×30 trigger sitting near the bottom-left of the 800×600 viewport. */
const rect = (top: number, left: number, w = 110, h = 30) => ({
  top,
  bottom: top + h,
  left,
  right: left + w,
});

describe("resolvePopoverPlacement — viewport-aware flip (same rule as <mythical-select>'s data-flip)", () => {
  test("plenty of room below ⇒ below", () => {
    expect(resolvePopoverPlacement(rect(40, 20), 200, VIEWPORT)).toBe("below");
  });

  test("would clip below AND fits above ⇒ above", () => {
    expect(resolvePopoverPlacement(rect(500, 20), 200, VIEWPORT)).toBe("above");
  });

  test("fits NEITHER side ⇒ stays below (never clipped against the top edge instead)", () => {
    // A 400px panel: 280 + 408 > 600 (clips below) but 250 - 408 < 0 (doesn't fit above either).
    expect(resolvePopoverPlacement(rect(250, 20), 400, VIEWPORT)).toBe("below");
  });

  test("the flip budget is exactly panelHeight + gap + breathing", () => {
    const need = 200 + POPOVER_GAP_PX + POPOVER_BREATHING_PX; // 208
    // bottom lands exactly at the budget ⇒ NOT greater than the viewport ⇒ still below.
    const exact = rect(VIEWPORT.height - need - 30, 20);
    expect(exact.bottom + need).toBe(VIEWPORT.height);
    expect(resolvePopoverPlacement(exact, 200, VIEWPORT)).toBe("below");
    // one pixel lower and it must flip
    expect(resolvePopoverPlacement(rect(exact.top + 1, 20), 200, VIEWPORT)).toBe("above");
  });

  test("above requires STRICTLY positive headroom (top - need > 0), not >= 0", () => {
    const need = 100 + POPOVER_GAP_PX + POPOVER_BREATHING_PX; // 108
    const flush = rect(need, 20); // top - need === 0 ⇒ not enough
    expect(resolvePopoverPlacement(flush, 100, { width: 800, height: flush.bottom })).toBe("below");
    expect(resolvePopoverPlacement(rect(need + 1, 20), 100, { width: 800, height: need + 1 + 30 })).toBe("above");
  });

  test("a custom gap widens the budget", () => {
    const anchor = rect(430, 20); // bottom 460
    // 140px panel at the default gap: 460 + 140 + 6 + 2 = 608 > 600 ⇒ flips.
    expect(resolvePopoverPlacement(anchor, 140, VIEWPORT)).toBe("above");
    // 100px panel: 460 + 108 = 568 ⇒ fits below …
    expect(resolvePopoverPlacement(anchor, 100, VIEWPORT)).toBe("below");
    // … until a 60px gap widens the budget to 462 + 160 = 622 > 600.
    expect(resolvePopoverPlacement(anchor, 100, VIEWPORT, 60)).toBe("above");
  });
});

describe("resolvePopoverAlign — start-aligned unless that overflows the right edge", () => {
  test("room to the right ⇒ start", () => {
    expect(resolvePopoverAlign(rect(40, 20), 210, VIEWPORT)).toBe("start");
  });

  test("would overflow right AND end-aligning fits ⇒ end", () => {
    // left 660, right 770: 660 + 210 = 870 overflows, but 770 and 770 - 210 = 560 both fit.
    expect(resolvePopoverAlign(rect(40, 660), 210, VIEWPORT)).toBe("end");
  });

  test("wider than the anchor's distance to BOTH edges ⇒ stays start (no overflow-swap)", () => {
    expect(resolvePopoverAlign(rect(40, 700), 900, VIEWPORT)).toBe("start");
  });

  test("exactly flush with the right edge is not an overflow ⇒ start", () => {
    const anchor = rect(40, VIEWPORT.width - 210);
    expect(anchor.left + 210).toBe(VIEWPORT.width);
    expect(resolvePopoverAlign(anchor, 210, VIEWPORT)).toBe("start");
    expect(resolvePopoverAlign(rect(40, anchor.left + 1), 210, VIEWPORT)).toBe("end");
  });

  test("end-aligning is allowed when it lands exactly on the left edge (>= 0)", () => {
    // right 800 (flush), panel 800 wide ⇒ right - width === 0, and right <= viewport.width ⇒ end.
    expect(resolvePopoverAlign({ top: 40, bottom: 70, left: 690, right: 800 }, 800, VIEWPORT)).toBe("end");
  });

  test("an anchor hanging off the LEFT edge end-aligns — start would clip it, end fits", () => {
    // left -10 (already off-screen), right 300, panel 210 ⇒ start spans -10..200 (clipped),
    // end spans 90..300 (fits). Checking only right-overflow would wrongly keep this at start.
    const offscreenLeft = { top: 40, bottom: 70, left: -10, right: 300 };
    expect(offscreenLeft.left + 210).toBeLessThanOrEqual(VIEWPORT.width); // no RIGHT overflow …
    expect(resolvePopoverAlign(offscreenLeft, 210, VIEWPORT)).toBe("end"); // … yet start clips
  });

  test("an anchor hanging off BOTH edges stays start — neither alignment fits", () => {
    const huge = { top: 40, bottom: 70, left: -50, right: 900 };
    expect(resolvePopoverAlign(huge, 210, VIEWPORT)).toBe("start");
  });

  test("an anchor hanging off the RIGHT edge must not end-align — that would clip the panel too", () => {
    // right 810 is already past the 800px viewport; end-aligning pins the panel's right edge THERE.
    // Checking only `right - panelWidth >= 0` (810 - 210 = 600) would wrongly call this a fit.
    const offscreen = { top: 40, bottom: 70, left: 700, right: 810 };
    expect(offscreen.right - 210).toBeGreaterThanOrEqual(0); // the left-edge-only test would pass …
    expect(resolvePopoverAlign(offscreen, 210, VIEWPORT)).toBe("start"); // … but both edges must fit
  });
});

describe("resolvePopoverPosition / samePopoverPosition", () => {
  test("composes both axes", () => {
    expect(resolvePopoverPosition(rect(500, 660), { width: 210, height: 200 }, VIEWPORT)).toEqual({
      placement: "above",
      align: "end",
    });
    expect(resolvePopoverPosition(rect(40, 20), { width: 210, height: 200 }, VIEWPORT)).toEqual(
      POPOVER_DEFAULT_POSITION,
    );
  });

  test("the default position is the design card's own (below, start)", () => {
    expect(POPOVER_DEFAULT_POSITION).toEqual({ placement: "below", align: "start" });
  });

  test("samePopoverPosition compares by value, so a re-measure cannot loop a binding's setState", () => {
    expect(samePopoverPosition({ placement: "above", align: "end" }, { placement: "above", align: "end" })).toBe(true);
    expect(samePopoverPosition({ placement: "above", align: "end" }, { placement: "below", align: "end" })).toBe(false);
    expect(samePopoverPosition({ placement: "above", align: "end" }, { placement: "above", align: "start" })).toBe(false);
  });
});

describe("class derivation", () => {
  test("popoverTriggerClass — base, open, disabled, both", () => {
    expect(popoverTriggerClass()).toBe("my-pop-trigger");
    expect(popoverTriggerClass({ open: true })).toBe("my-pop-trigger is-open");
    expect(popoverTriggerClass({ disabled: true })).toBe("my-pop-trigger is-disabled");
    expect(popoverTriggerClass({ open: true, disabled: true })).toBe("my-pop-trigger is-open is-disabled");
  });

  test("popoverPanelClass — one modifier per flipped axis, none when default", () => {
    expect(popoverPanelClass()).toBe("my-pop");
    expect(popoverPanelClass({ placement: "above", align: "start" })).toBe("my-pop my-pop--above");
    expect(popoverPanelClass({ placement: "below", align: "end" })).toBe("my-pop my-pop--end");
    expect(popoverPanelClass({ placement: "above", align: "end" })).toBe("my-pop my-pop--above my-pop--end");
  });

  test("popoverItemClass — selected/disabled modifiers", () => {
    expect(popoverItemClass()).toBe("my-pop__item");
    expect(popoverItemClass({ selected: true })).toBe("my-pop__item is-selected");
    expect(popoverItemClass({ disabled: true })).toBe("my-pop__item is-disabled");
    expect(popoverItemClass({ selected: true, disabled: true })).toBe("my-pop__item is-selected is-disabled");
  });
});

describe("ARIA derivation", () => {
  const ids = popoverIds("pop1");

  test("popoverIds derives a collision-free id set from one base", () => {
    expect(ids).toEqual({
      trigger: "pop1-trigger",
      panel: "pop1-panel",
      menu: "pop1-menu",
      title: "pop1-title",
    });
    expect(new Set(Object.values(ids)).size).toBe(4);
  });

  test("the trigger advertises a menu and only points at the MENU while it EXISTS", () => {
    expect(popoverTriggerAria(false, ids)).toEqual({
      id: "pop1-trigger",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
      "aria-controls": undefined,
    });
    expect(popoverTriggerAria(true, ids)["aria-controls"]).toBe("pop1-menu");
  });

  test("the visual panel carries NO role — a menu may not own a heading or arbitrary footer", () => {
    expect(popoverPanelAria(ids)).toEqual({ id: "pop1-panel" });
    expect(popoverPanelAria(ids)).not.toHaveProperty("role");
  });

  test("the nested menu is named by its heading when there is one, else by the trigger", () => {
    expect(popoverMenuAria(ids, false)).toEqual({
      id: "pop1-menu",
      role: "menu",
      "aria-labelledby": "pop1-trigger",
    });
    expect(popoverMenuAria(ids, true)["aria-labelledby"]).toBe("pop1-title");
  });

  test("rows are single-select radios; aria-checked is always present, aria-disabled only when true", () => {
    expect(popoverItemAria({})).toEqual({
      role: "menuitemradio",
      "aria-checked": "false",
      "aria-disabled": undefined,
    });
    expect(popoverItemAria({ selected: true })["aria-checked"]).toBe("true");
    expect(popoverItemAria({ disabled: true })["aria-disabled"]).toBe("true");
  });
});

describe("keyboard grammar", () => {
  test("closed trigger: arrows open at the matching end; Enter/Space are left to the native button", () => {
    expect(popoverTriggerKeyAction("ArrowDown")).toBe("open-first");
    expect(popoverTriggerKeyAction("ArrowUp")).toBe("open-last");
    expect(popoverTriggerKeyAction("Enter")).toBeNull();
    expect(popoverTriggerKeyAction(" ")).toBeNull();
    expect(popoverTriggerKeyAction("Escape")).toBeNull();
    expect(popoverTriggerKeyAction("a")).toBeNull();
  });

  test("open panel: Escape closes, Tab dismisses, arrows/Home/End rove, anything else is ignored", () => {
    const cases: [string, PopoverPanelKeyAction][] = [
      ["Escape", "close"],
      ["Tab", "dismiss"],
      ["ArrowDown", "next"],
      ["ArrowUp", "prev"],
      ["Home", "first"],
      ["End", "last"],
      ["Enter", null],
      ["x", null],
    ];
    for (const [key, expected] of cases) expect(popoverPanelKeyAction(key)).toBe(expected);
  });

  test("popoverKeyHandled — Tab must keep its native behaviour or the popover becomes a focus trap", () => {
    expect(popoverKeyHandled("dismiss")).toBe(false);
    expect(popoverKeyHandled(null)).toBe(false);
    for (const a of ["close", "next", "prev", "first", "last"] as const) {
      expect(popoverKeyHandled(a)).toBe(true);
    }
  });
});

describe("roving-focus arithmetic — disabled rows are skipped, ends wrap", () => {
  const items: PopoverItem[] = [
    { key: "a", label: "A" },
    { key: "b", label: "B", disabled: true },
    { key: "c", label: "C", selected: true },
  ];

  test("edgePopoverIndex finds the first/last ENABLED row", () => {
    expect(edgePopoverIndex(items, 1)).toBe(0);
    expect(edgePopoverIndex(items, -1)).toBe(2);
    expect(edgePopoverIndex([{ key: "a", label: "A", disabled: true }, ...items.slice(1)], 1)).toBe(2);
  });

  test("edgePopoverIndex returns -1 for an empty or fully disabled list", () => {
    expect(edgePopoverIndex([], 1)).toBe(-1);
    expect(edgePopoverIndex([{ key: "a", label: "A", disabled: true }], 1)).toBe(-1);
    expect(edgePopoverIndex([{ key: "a", label: "A", disabled: true }], -1)).toBe(-1);
  });

  test("stepPopoverIndex skips disabled and wraps in both directions", () => {
    expect(stepPopoverIndex(items, 0, 1)).toBe(2); // skips the disabled b
    expect(stepPopoverIndex(items, 2, 1)).toBe(0); // wraps forward
    expect(stepPopoverIndex(items, 0, -1)).toBe(2); // wraps backward
    expect(stepPopoverIndex(items, 2, -1)).toBe(0); // skips b backwards
  });

  test("a lone enabled row wraps back onto itself rather than reporting 'nothing'", () => {
    const lone: PopoverItem[] = [
      { key: "a", label: "A" },
      { key: "b", label: "B", disabled: true },
    ];
    expect(stepPopoverIndex(lone, 0, 1)).toBe(0);
    expect(stepPopoverIndex(lone, 0, -1)).toBe(0);
  });

  test("stepPopoverIndex returns -1 when nothing is focusable", () => {
    expect(stepPopoverIndex([], 0, 1)).toBe(-1);
    expect(stepPopoverIndex([{ key: "a", label: "A", disabled: true }], 0, 1)).toBe(-1);
  });

  test("initialPopoverIndex — the selected row, else the first enabled one", () => {
    expect(initialPopoverIndex(items)).toBe(2);
    expect(initialPopoverIndex([{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe(0);
  });

  test("initialPopoverIndex — a selected-but-DISABLED row never swallows focus", () => {
    expect(
      initialPopoverIndex([
        { key: "a", label: "A" },
        { key: "b", label: "B", selected: true, disabled: true },
      ]),
    ).toBe(0);
  });

  test("initialPopoverIndex — -1 when there is nothing to focus", () => {
    expect(initialPopoverIndex([])).toBe(-1);
    expect(initialPopoverIndex([{ key: "a", label: "A", disabled: true }])).toBe(-1);
  });

  test("resolvePopoverIndex maps every navigation action", () => {
    expect(resolvePopoverIndex("next", items, 0)).toBe(2);
    expect(resolvePopoverIndex("prev", items, 0)).toBe(2);
    expect(resolvePopoverIndex("first", items, 2)).toBe(0);
    expect(resolvePopoverIndex("last", items, 0)).toBe(2);
  });

  test("resolvePopoverIndex leaves the index alone for non-navigation actions", () => {
    for (const a of ["close", "dismiss", null] as const) {
      expect(resolvePopoverIndex(a, items, 1)).toBe(1);
    }
  });

  test("from 'no row focused' (-1), Down means FIRST and Up means LAST — not wrap arithmetic off -1", () => {
    expect(resolvePopoverIndex("next", items, -1)).toBe(0);
    expect(resolvePopoverIndex("prev", items, -1)).toBe(2);
  });
});

describe("trigger text composition — never names an item that is not actually selected", () => {
  test("shows the selected row's label, with the caller's prefix", () => {
    expect(
      popoverTriggerText(
        [
          { key: "a", label: "codex cross-model", selected: true },
          { key: "b", label: "clean-context ephemeral" },
        ],
        { label: "review lane:" },
      ),
    ).toEqual({ label: "review lane:", value: "codex cross-model" });
  });

  test("no selection ⇒ the em-dash placeholder, and no prefix ⇒ null (not an empty string)", () => {
    expect(popoverTriggerText([{ key: "a", label: "A" }])).toEqual({ label: null, value: POPOVER_EMPTY_VALUE });
    expect(popoverTriggerText([])).toEqual({ label: null, value: POPOVER_EMPTY_VALUE });
  });

  test("a caller-supplied placeholder overrides the em-dash", () => {
    expect(popoverTriggerText([], { placeholder: "no project configured" }).value).toBe("no project configured");
  });

  test("the FIRST selected row wins if a caller passes a malformed multi-selected list", () => {
    expect(
      popoverTriggerText([
        { key: "a", label: "A", selected: true },
        { key: "b", label: "B", selected: true },
      ]).value,
    ).toBe("A");
  });
});

describe("glyphs match the design card", () => {
  test("caret ▾ on the trigger, ✓ on the current row", () => {
    expect(POPOVER_CARET).toBe("▾");
    expect(POPOVER_CHECK).toBe("✓");
  });
});

describe("styles.css ships a real selector for every class this logic emits", () => {
  const css = readFileSync(join(import.meta.dir, "..", "..", "styles.css"), "utf8");
  // Comments must go first: this file DOCUMENTS class names in prose (e.g. the flip modifiers and
  // `.my-pop-anchor`), so scanning the raw text would let a DELETED rule keep passing on the
  // strength of its own comment. The sanity test below proves the stripper isn't a no-op.
  const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const hasSelector = (cls: string) =>
    new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(cssRules);

  test("sanity: comment stripping is real, and it does not eat the rules", () => {
    expect(css).toContain("dropdown popover (ds/components-popover"); // present in the raw text …
    expect(cssRules).not.toContain("dropdown popover (ds/components-popover"); // … gone from rules
    expect(cssRules).toContain(".my-pop-trigger {");
    expect(cssRules.length).toBeGreaterThan(3000);
  });

  const emitted = new Set<string>();
  for (const s of [{}, { open: true }, { disabled: true }, { open: true, disabled: true }]) {
    for (const c of popoverTriggerClass(s).split(" ")) emitted.add(c);
  }
  for (const placement of ["below", "above"] as const) {
    for (const align of ["start", "end"] as const) {
      for (const c of popoverPanelClass({ placement, align }).split(" ")) emitted.add(c);
    }
  }
  for (const s of [{}, { selected: true }, { disabled: true }]) {
    for (const c of popoverItemClass(s).split(" ")) emitted.add(c);
  }

  test("the emitted set actually covers every class in POPOVER_CLASS (no silently unstyled name)", () => {
    const all = new Set<string>(Object.values(POPOVER_CLASS));
    for (const c of emitted) all.delete(c);
    // whatever the derivation functions don't emit is structural — the bindings render it directly
    expect(all.size).toBeGreaterThan(0);
    expect(emitted.size + all.size).toBe(Object.keys(POPOVER_CLASS).length);
  });

  test.each(Object.values(POPOVER_CLASS))("styles.css defines a rule reaching .%s", (cls) => {
    expect(hasSelector(cls)).toBe(true);
  });

  test("the state modifiers are styled on the popover's OWN elements, not borrowed from another atom", () => {
    expect(cssRules).toMatch(/\.my-pop-trigger\.is-open/);
    expect(cssRules).toMatch(/\.my-pop-trigger\.is-disabled/);
    expect(cssRules).toMatch(/\.my-pop__item\.is-selected/);
    expect(cssRules).toMatch(/\.my-pop__item\.is-disabled/);
  });

  test("design rule 6 — the popover's interactive controls carry the shared focus ring", () => {
    const ring = cssRules.match(
      /\.my-pop-trigger:focus-visible,\s*\.my-pop__item:focus-visible\s*\{([^}]*)\}/,
    );
    expect(ring).not.toBeNull();
    expect(ring?.[1]).toContain("outline: 2px solid var(--my-accent)");
    expect(ring?.[1]).toContain("outline-offset: 2px");
  });

  test("shape rule 10 — every clickable surface here is SQUARED (--my-r-control), never the pill", () => {
    for (const sel of ["my-pop-trigger", "my-pop__item"]) {
      const rule = cssRules.match(new RegExp(`\\.${sel}\\s*\\{([^}]*)\\}`));
      expect(rule).not.toBeNull();
      expect(rule?.[1]).toContain("border-radius: var(--my-r-control)");
    }
    // scan the popover's rules only, comments already stripped, so a prose mention can't trip it
    const popoverRules = cssRules.slice(cssRules.indexOf(".my-pop-anchor"));
    expect(popoverRules.length).toBeGreaterThan(500);
    expect(popoverRules).not.toContain("--my-r-pill");
  });

  test("the flip modifiers actually re-anchor the panel (not just a cosmetic class)", () => {
    expect(cssRules).toMatch(/\.my-pop--above\s*\{[^}]*bottom:\s*calc\(100% \+ 6px\)/);
    expect(cssRules).toMatch(/\.my-pop--end\s*\{[^}]*right:\s*0/);
  });

  test("a full-width row is border-box, so its fill and focus ring stay inside the panel's padding", () => {
    const item = cssRules.match(/\.my-pop__item\s*\{([^}]*)\}/);
    expect(item?.[1]).toContain("width: 100%");
    expect(item?.[1]).toContain("box-sizing: border-box");
  });

  test("the open trigger matches <mythical-select>'s own open state, token for token", () => {
    const selectCss = readFileSync(
      join(import.meta.dir, "..", "..", "src", "select", "mythical-select.js"),
      "utf8",
    );
    expect(selectCss).toContain(":host([data-open]) button{border-color:var(--my-accent");
    expect(cssRules).toMatch(/\.my-pop-trigger\.is-open\s*\{[^}]*border-color:\s*var\(--my-accent\)/);
  });

  test("panel fidelity — min-width only (no undocumented max-width cap), card z-index and shadow", () => {
    const panel = cssRules.match(/\.my-pop\s*\{([^}]*)\}/);
    expect(panel).not.toBeNull();
    expect(panel?.[1]).toContain("min-width: 210px");
    expect(panel?.[1]).not.toContain("max-width");
    expect(panel?.[1]).toContain("z-index: 30");
    expect(panel?.[1]).toContain("box-shadow: var(--my-shadow-modal)");
    expect(panel?.[1]).toContain("top: calc(100% + 6px)");
  });
});
