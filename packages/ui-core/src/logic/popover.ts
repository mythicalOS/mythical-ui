// @mythicalos/ui-core — PURE, DOM-free dropdown-popover logic (ds/components-popover, the
// component registry's `popover` v1 row). The design card is a chip trigger ("review lane:
// **codex cross-model** ▾") over an anchored panel — `--my-shadow-modal`, high z-index, ✓ marking
// the current item, and "ancestors must never clip it".
//
// EVERY decision the popover makes lives here so the Preact and React bindings can only ever
// render, never decide: class derivation, the viewport-aware flip/align geometry, the keyboard
// grammar (which key does what), roving-focus index arithmetic that skips disabled rows, the
// trigger's text composition, and the ARIA attribute maps. The bindings own exactly two things
// this module cannot: touching the DOM (measuring, focusing, listening) and rendering.
//
// Geometry provenance: `resolvePopoverPlacement` reproduces the established approach in
// `src/select/mythical-select.js`'s `data-flip` handling — flip up only when the panel would clip
// below AND genuinely fits above, measured as `panelHeight + gap + breathing` against the
// viewport. Keeping one rule means <mythical-select> and <Popover> never disagree about which way
// a list opens on the same screen.

/** Trigger caret (design card: `<span class="car">▾</span>`). */
export const POPOVER_CARET = "▾";
/** Selected-item marker (design card: "✓ marks current"). */
export const POPOVER_CHECK = "✓";
/** Anchor gap in px — the design card's `top: calc(100% + 6px)`. Mirrored in styles.css. */
export const POPOVER_GAP_PX = 6;
/** Extra breathing room the flip test demands beyond the gap (mythical-select uses `height + 8`
 * for a 6px gap — i.e. gap + 2). */
export const POPOVER_BREATHING_PX = 2;
/** Trigger value shown when nothing is selected (the em-dash placeholder, as in the product's
 * hand-rolled selector) — never a fabricated item label. */
export const POPOVER_EMPTY_VALUE = "—";

/** One row of the popover's single-select menu. */
export interface PopoverItem {
  /** Stable identity handed back to `onSelect` — never the array index. */
  key: string;
  label: string;
  /** Marks the current choice: gets the ✓ and `aria-checked="true"`. */
  selected?: boolean;
  /** Rendered, focusable-by-arrow? No — skipped by roving focus and inert on click. */
  disabled?: boolean;
}

export type PopoverPlacement = "below" | "above";
export type PopoverAlign = "start" | "end";

export interface PopoverPosition {
  placement: PopoverPlacement;
  align: PopoverAlign;
}

/** The pre-measurement position: the design card's own (anchored below, left-aligned). A binding
 * renders this on the first open frame, then corrects it once the panel can be measured. */
export const POPOVER_DEFAULT_POSITION: PopoverPosition = { placement: "below", align: "start" };

/** The subset of a DOMRect this module needs (so callers can pass a real rect or a plain object). */
export interface PopoverRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PopoverSize {
  width: number;
  height: number;
}

export interface PopoverViewport {
  width: number;
  height: number;
}

/**
 * Viewport-aware vertical placement. Flips UP only when the panel would clip off the bottom AND it
 * genuinely fits above — a panel taller than both gaps stays `below` (scrolling down to it beats
 * clipping it against the top edge, and it matches <mythical-select>'s behaviour exactly).
 */
export function resolvePopoverPlacement(
  anchor: PopoverRect,
  panelHeight: number,
  viewport: PopoverViewport,
  gap: number = POPOVER_GAP_PX,
): PopoverPlacement {
  const need = panelHeight + gap + POPOVER_BREATHING_PX;
  return anchor.bottom + need > viewport.height && anchor.top - need > 0 ? "above" : "below";
}

/**
 * Viewport-aware horizontal alignment. The panel is start-aligned (design card: `left: 0`) and
 * switches to end-aligned only when start does NOT fit and end does.
 *
 * "Fits" means BOTH resulting edges are inside the viewport, on both branches — an alignment pins
 * one panel edge to the matching anchor edge, so an anchor that is itself partly off-screen drags
 * the panel off with it. Testing only the far edge is wrong in each direction symmetrically:
 * start-aligning an anchor hanging off the LEFT clips the panel's left edge even though its right
 * edge is comfortable, and end-aligning an anchor hanging off the RIGHT clips its right edge even
 * though `right - panelWidth >= 0`. A panel that fits neither way stays `start` — flipping would
 * only trade one overflow for the other.
 */
export function resolvePopoverAlign(
  anchor: PopoverRect,
  panelWidth: number,
  viewport: PopoverViewport,
): PopoverAlign {
  const startFits = anchor.left >= 0 && anchor.left + panelWidth <= viewport.width;
  const endFits = anchor.right <= viewport.width && anchor.right - panelWidth >= 0;
  return !startFits && endFits ? "end" : "start";
}

/** Both axes at once — what a binding calls from its post-open measurement effect. */
export function resolvePopoverPosition(
  anchor: PopoverRect,
  panel: PopoverSize,
  viewport: PopoverViewport,
  gap: number = POPOVER_GAP_PX,
): PopoverPosition {
  return {
    placement: resolvePopoverPlacement(anchor, panel.height, viewport, gap),
    align: resolvePopoverAlign(anchor, panel.width, viewport),
  };
}

/** True when two positions describe the same placement — lets a binding skip a redundant
 * re-render after re-measuring (and, more importantly, not loop measure→setState→measure). */
export function samePopoverPosition(a: PopoverPosition, b: PopoverPosition): boolean {
  return a.placement === b.placement && a.align === b.align;
}

/* ── class derivation ─────────────────────────────────────────────────── */

/**
 * EVERY class name this component family renders — the derived ones the functions below compose
 * AND the purely structural ones a binding puts on a wrapper/span. One source, so a binding cannot
 * invent, misspell, or quietly re-style a class, and the Preact and React siblings cannot drift on
 * markup either. (The rest of this package's atoms inline their structural classes in both
 * bindings; the popover has more of them than any other atom, so it earns the map.)
 */
export const POPOVER_CLASS = {
  anchor: "my-pop-anchor",
  trigger: "my-pop-trigger",
  triggerLabel: "my-pop-trigger__label",
  triggerValue: "my-pop-trigger__value",
  triggerCaret: "my-pop-trigger__caret",
  panel: "my-pop",
  panelAbove: "my-pop--above",
  panelEnd: "my-pop--end",
  head: "my-pop__head",
  title: "my-pop__title",
  caption: "my-pop__caption",
  menu: "my-pop__menu",
  item: "my-pop__item",
  itemLabel: "my-pop__label",
  itemCheck: "my-pop__check",
  divider: "my-pop__div",
  foot: "my-pop__foot",
  isOpen: "is-open",
  isSelected: "is-selected",
  isDisabled: "is-disabled",
} as const;

export interface PopoverTriggerState {
  open?: boolean;
  disabled?: boolean;
}

/** Trigger class list. Shape rule 10: the trigger is clickable, so styles.css gives it
 * `--my-r-control` — never the pill radius. */
export function popoverTriggerClass(s: PopoverTriggerState = {}): string {
  const cls: string[] = [POPOVER_CLASS.trigger];
  if (s.open) cls.push(POPOVER_CLASS.isOpen);
  if (s.disabled) cls.push(POPOVER_CLASS.isDisabled);
  return cls.join(" ");
}

/** Panel class list; the flip/align modifiers are the only thing position changes. */
export function popoverPanelClass(pos: PopoverPosition = POPOVER_DEFAULT_POSITION): string {
  const cls: string[] = [POPOVER_CLASS.panel];
  if (pos.placement === "above") cls.push(POPOVER_CLASS.panelAbove);
  if (pos.align === "end") cls.push(POPOVER_CLASS.panelEnd);
  return cls.join(" ");
}

/** Menu-row class list. */
export function popoverItemClass(item: Pick<PopoverItem, "selected" | "disabled"> = {}): string {
  const cls: string[] = [POPOVER_CLASS.item];
  if (item.selected) cls.push(POPOVER_CLASS.isSelected);
  if (item.disabled) cls.push(POPOVER_CLASS.isDisabled);
  return cls.join(" ");
}

/* ── ARIA derivation ──────────────────────────────────────────────────── */

export interface PopoverIds {
  trigger: string;
  /** The visual panel — the surface that carries the border/shadow and the optional head/footer. */
  panel: string;
  /** The `role="menu"` element NESTED in the panel. A menu may only own menuitem-family, group and
   * separator children, so the heading and the caller's footer are siblings of this element, not
   * children of it — putting them inside would make the menu's owned content invalid and let
   * assistive tech drop or mis-announce them. */
  menu: string;
  /** The heading, when there is one — it names the menu in place of the trigger. */
  title: string;
}

/** Stable, collision-free id set derived from one caller-supplied base id. */
export function popoverIds(baseId: string): PopoverIds {
  return {
    trigger: `${baseId}-trigger`,
    panel: `${baseId}-panel`,
    menu: `${baseId}-menu`,
    title: `${baseId}-title`,
  };
}

export interface PopoverTriggerAria {
  id: string;
  "aria-haspopup": "menu";
  "aria-expanded": "true" | "false";
  /** The MENU (not the panel wrapper) it controls, and only while open — the element does not
   * exist when closed, and pointing at a missing id is an authoring error assistive tech reports. */
  "aria-controls": string | undefined;
}

export function popoverTriggerAria(open: boolean, ids: PopoverIds): PopoverTriggerAria {
  return {
    id: ids.trigger,
    "aria-haspopup": "menu",
    "aria-expanded": open ? "true" : "false",
    "aria-controls": open ? ids.menu : undefined,
  };
}

export interface PopoverPanelAria {
  id: string;
}

/** The visual panel: the surface, deliberately WITHOUT a role. It holds the optional heading and
 * the caller's footer, which a `menu` may not own. */
export function popoverPanelAria(ids: PopoverIds): PopoverPanelAria {
  return { id: ids.panel };
}

export interface PopoverMenuAria {
  id: string;
  role: "menu";
  "aria-labelledby": string;
}

/** The nested menu, which owns ONLY the `menuitemradio` rows. Named by the heading when there is
 * one (the more specific label), otherwise by the trigger. */
export function popoverMenuAria(ids: PopoverIds, titled: boolean): PopoverMenuAria {
  return { id: ids.menu, role: "menu", "aria-labelledby": titled ? ids.title : ids.trigger };
}

/**
 * The caret and the ✓ are pure decoration: the trigger's `aria-expanded` and the row's
 * `aria-checked` already convey both states, so reading the glyphs would duplicate them. Lives here
 * rather than inline in each binding so neither can quietly un-hide one.
 */
export const POPOVER_DECORATIVE_ARIA = { "aria-hidden": "true" } as const;

/** The rule between the menu and the caller's footer — a real separator, not a styled `<div>`. */
export const POPOVER_SEPARATOR_ARIA = { role: "separator" } as const;

export interface PopoverItemAria {
  /** Single-select menu ⇒ radio semantics, so a screen reader announces "1 of N, checked". */
  role: "menuitemradio";
  "aria-checked": "true" | "false";
  "aria-disabled": "true" | undefined;
}

export function popoverItemAria(item: Pick<PopoverItem, "selected" | "disabled">): PopoverItemAria {
  return {
    role: "menuitemradio",
    "aria-checked": item.selected ? "true" : "false",
    "aria-disabled": item.disabled ? "true" : undefined,
  };
}

/* ── keyboard grammar ─────────────────────────────────────────────────── */

/** What a key pressed on the CLOSED trigger means. Enter/Space are deliberately absent: the
 * trigger is a real `<button>`, so the browser already synthesises a click from them — handling
 * them here too would toggle twice. */
export type PopoverTriggerKeyAction = "open-first" | "open-last" | null;

export function popoverTriggerKeyAction(key: string): PopoverTriggerKeyAction {
  if (key === "ArrowDown") return "open-first";
  if (key === "ArrowUp") return "open-last";
  return null;
}

/**
 * What a key pressed INSIDE the open panel means.
 *  - `close`   — Escape: close and pull focus back to the trigger (never strand it on <body>).
 *  - `dismiss` — Tab: close, but let the browser move focus onward normally.
 *  - the rest  — roving focus.
 */
export type PopoverPanelKeyAction = "close" | "dismiss" | "next" | "prev" | "first" | "last" | null;

export function popoverPanelKeyAction(key: string): PopoverPanelKeyAction {
  switch (key) {
    case "Escape":
      return "close";
    case "Tab":
      return "dismiss";
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "prev";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/** Should the binding call `preventDefault()`? Everything we act on, except `dismiss` — Tab MUST
 * keep its native behaviour or the popover becomes a focus trap. */
export function popoverKeyHandled(action: PopoverPanelKeyAction): boolean {
  return action !== null && action !== "dismiss";
}

/**
 * Does this action apply to the element that currently has focus?
 *
 * Dismissal (Escape / Tab) applies from ANYWHERE inside the popover — including the caller's
 * footer content, where Escape must still close. Roving (arrows / Home / End) applies ONLY when
 * focus is on a menu row or on the panel fallback. That distinction is load-bearing, not tidiness:
 * a footer control is arbitrary caller markup, so swallowing Home/End there would steal a text
 * input's caret keys, and swallowing an arrow would yank focus out of the footer and into the menu.
 * The binding supplies the one thing this module cannot compute — whether the focused element is a
 * roving surface.
 */
export function popoverAppliesToFocus(
  action: PopoverPanelKeyAction,
  focusOnRovingSurface: boolean,
): boolean {
  if (action === null) return false;
  if (action === "close" || action === "dismiss") return true;
  return focusOnRovingSurface;
}

/* ── roving-focus index arithmetic (disabled rows are skipped, ends wrap) ── */

/** Index of the first enabled item scanning forward (`dir` 1) or backward (`dir` -1); -1 if every
 * item is disabled (or the list is empty). */
export function edgePopoverIndex(items: readonly PopoverItem[], dir: 1 | -1 = 1): number {
  const n = items.length;
  for (let step = 0; step < n; step++) {
    const i = dir === 1 ? step : n - 1 - step;
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

/** The next enabled index from `from` in `dir`, wrapping. Returns -1 when nothing is enabled and
 * `from` itself when it is the ONLY enabled row (a wrap that lands back where it started). */
export function stepPopoverIndex(items: readonly PopoverItem[], from: number, dir: 1 | -1): number {
  const n = items.length;
  if (n === 0) return -1;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (!items[i]?.disabled) return i;
  }
  return -1;
}

/**
 * Where focus lands when the panel opens: the selected row if it is focusable, else the first
 * enabled one. A selected-but-disabled row does not swallow focus.
 */
export function initialPopoverIndex(items: readonly PopoverItem[]): number {
  const sel = items.findIndex((it) => it.selected && !it.disabled);
  return sel >= 0 ? sel : edgePopoverIndex(items, 1);
}

/**
 * The single entry point a binding's keydown handler calls: maps a panel key action + the current
 * focused index to the next focused index. Non-navigation actions (and a null action) leave the
 * index untouched, so the caller never has to branch on the action twice.
 *
 * `current < 0` means "focus is in the panel but not on a row" (an all-disabled or empty list, or
 * a click that landed on the panel's padding). From there Down means the FIRST enabled row and Up
 * means the LAST — not a wrap arithmetic accident off index -1.
 */
export function resolvePopoverIndex(
  action: PopoverPanelKeyAction,
  items: readonly PopoverItem[],
  current: number,
): number {
  switch (action) {
    case "next":
      return current < 0 ? edgePopoverIndex(items, 1) : stepPopoverIndex(items, current, 1);
    case "prev":
      return current < 0 ? edgePopoverIndex(items, -1) : stepPopoverIndex(items, current, -1);
    case "first":
      return edgePopoverIndex(items, 1);
    case "last":
      return edgePopoverIndex(items, -1);
    default:
      return current;
  }
}

/* ── optional slots ───────────────────────────────────────────────────── */

/**
 * Is an optional slot (heading, caption, footer) worth rendering its chrome?
 *
 * `undefined`, `null`, `false` and `""` are all values BOTH frameworks render as nothing, and the
 * idiomatic conditional slot is `footer={enabled && <Action />}` — which passes `false`, not
 * `undefined`, when disabled. Testing `!== undefined` would leave an orphan separator and an empty
 * box behind it, and an empty heading would leave the menu's `aria-labelledby` pointing at an
 * element with no text. Shared here so both bindings apply the same rule.
 */
export function popoverHasSlotContent(slot: unknown): boolean {
  return slot !== undefined && slot !== null && slot !== false && slot !== "";
}

/* ── text composition ─────────────────────────────────────────────────── */

export interface PopoverTriggerText {
  /** The static prefix ("review lane:") — null when the caller supplies none. */
  label: string | null;
  /** The current selection's label, or the em-dash placeholder. Never invented. */
  value: string;
}

export interface PopoverTriggerTextOptions {
  label?: string;
  /** Overrides {@link POPOVER_EMPTY_VALUE} for the no-selection case. */
  placeholder?: string;
}

/**
 * The trigger face: prefix + the CURRENTLY selected item's label. Honest by construction — with no
 * selection (or a selection that is not in the list) it shows the placeholder rather than naming an
 * item that is not actually chosen.
 */
export function popoverTriggerText(
  items: readonly PopoverItem[],
  opts: PopoverTriggerTextOptions = {},
): PopoverTriggerText {
  const sel = items.find((it) => it.selected);
  return {
    label: opts.label ?? null,
    value: sel ? sel.label : (opts.placeholder ?? POPOVER_EMPTY_VALUE),
  };
}

// Deliberately NOT exported: an `aria-label` for the trigger. The trigger renders its label and
// value as real text (only the caret is aria-hidden), so its accessible name is already computed
// from exactly what the eye reads. Adding an aria-label would override that visible text — the
// classic "label in name" failure — so the panel points at the trigger with `aria-labelledby`
// instead of anyone re-deriving a string.
