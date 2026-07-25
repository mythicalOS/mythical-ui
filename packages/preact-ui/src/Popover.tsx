/** @jsxImportSource preact */
// @mythicalos/preact-ui — the dropdown popover (ds/components-popover, registry row `popover` v1).
// A chip trigger over an anchored single-select menu: "review lane: **codex cross-model** ▾", ✓ on
// the current row, `--my-shadow-modal`, high z-index.
//
// This file is WIRING ONLY. Every decision — class strings, the viewport-aware flip/align
// geometry, which key does what, roving-focus index arithmetic that skips disabled rows, the
// trigger's text composition, and the ARIA maps — is imported from `@mythicalos/ui-core`, so this
// binding and its React sibling cannot drift. The three things that genuinely cannot live in the
// core are all this component adds: measuring the DOM, moving focus, and rendering.
//
// Behavioural requirements were taken from the design card plus the hand-rolled selector the
// product ships today (rail/ProjectSelector.tsx): outside-pointerdown and Escape close; Escape and
// selecting BOTH return focus to the trigger (never stranding it on <body>); focus moves INTO the
// menu on open, landing on the selected row; Arrow/Home/End rove within it; and an optional
// head (title + caption) and footer action sit around the rows.
//
// Documented residual: the flip/align decision is re-measured on open, on window resize, and on
// any scroll — but not on a mutation that changes the panel's own size while it is open (no
// ResizeObserver). `<mythical-select>` measures on open only; this is a superset of the
// established approach, not a regression against it.
//
// Consumer contract (design card, verbatim): "Ancestors must never clip it." The panel is
// absolutely positioned inside `.my-pop-anchor`, so an ancestor with `overflow: hidden`/`auto`
// will crop it.

import { useEffect, useId, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, Ref } from "preact";
import {
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_CLASS,
  POPOVER_DECORATIVE_ARIA,
  POPOVER_DEFAULT_POSITION,
  POPOVER_SEPARATOR_ARIA,
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
  resolvePopoverIndex,
  resolvePopoverPosition,
  samePopoverPosition,
  type PopoverIds,
  type PopoverItem,
  type PopoverPosition,
} from "@mythicalos/ui-core/logic";

export {
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_CLASS,
  POPOVER_EMPTY_VALUE,
  popoverItemClass,
  popoverPanelClass,
  popoverTriggerClass,
  popoverTriggerText,
  resolvePopoverPosition,
  type PopoverItem,
  type PopoverPosition,
} from "@mythicalos/ui-core/logic";

export interface PopoverProps {
  /** The menu rows, in display order. Exactly one may carry `selected`. */
  items: PopoverItem[];
  /** Picking a row: closes the popover, returns focus to the trigger, then calls this. */
  onSelect: (key: string, item: PopoverItem) => void;
  /** Static prefix on the trigger, e.g. `"review lane:"`. */
  label?: string;
  /** Trigger value when nothing is selected (default: the em-dash placeholder). */
  placeholder?: string;
  /** Optional panel heading. */
  title?: string;
  /** Optional second heading line — the honest framing/caveat line. */
  caption?: string;
  /** Optional content below a divider (e.g. a "Manage projects →" action). Rows in here are the
   * caller's own elements; the arrow-key roving above covers `items` only. */
  footer?: ComponentChildren;
  disabled?: boolean;
  /** Base for the trigger/panel id pair. Defaults to a generated one. */
  id?: string;
  /** Longer description for the trigger (native tooltip). Not the accessible NAME — the trigger's
   * visible label + value already provide that. */
  triggerTitle?: string;
  onOpenChange?: (open: boolean) => void;
}

export interface PopoverPanelProps {
  ids: PopoverIds;
  pos: PopoverPosition;
  items: PopoverItem[];
  onPick: (item: PopoverItem) => void;
  title?: string;
  caption?: string;
  footer?: ComponentChildren;
  panelRef?: Ref<HTMLDivElement>;
}

/**
 * The OPEN panel, deliberately hook-free (same testability split as the shell's `SwitcherPanel`):
 * `preact-render-to-string` never runs effects or dispatches events, so the panel markup — and a
 * row's REAL onClick closure, reachable off the returned vnode tree — would otherwise be
 * unreachable from a DOM-free test. Exported from this module for tests; NOT part of the package
 * barrel. `panelRef` rather than `ref` because plain Preact does not forward `ref` to a function
 * component, and the React sibling keeps the same prop name so the two stay symmetric.
 */
export function PopoverPanel(props: PopoverPanelProps) {
  return (
    <div ref={props.panelRef} class={popoverPanelClass(props.pos)} tabIndex={-1} {...popoverPanelAria(props.ids)}>
      {props.title !== undefined || props.caption !== undefined ? (
        <div class={POPOVER_CLASS.head}>
          {props.title !== undefined ? (
            <span id={props.ids.title} class={POPOVER_CLASS.title}>
              {props.title}
            </span>
          ) : null}
          {props.caption !== undefined ? <span class={POPOVER_CLASS.caption}>{props.caption}</span> : null}
        </div>
      ) : null}
      <div class={POPOVER_CLASS.menu} {...popoverMenuAria(props.ids, props.title !== undefined)}>
        {props.items.map((item) => (
          <button
            key={item.key}
            type="button"
            data-pop-item=""
            class={popoverItemClass(item)}
            disabled={item.disabled}
            {...popoverItemAria(item)}
            onClick={() => {
              if (item.disabled) return; // belt-and-braces: a native disabled button fires no click
              props.onPick(item);
            }}
          >
            <span class={POPOVER_CLASS.itemLabel}>{item.label}</span>
            <span class={POPOVER_CLASS.itemCheck} {...POPOVER_DECORATIVE_ARIA}>
              {item.selected ? POPOVER_CHECK : ""}
            </span>
          </button>
        ))}
      </div>
      {props.footer !== undefined ? (
        <>
          <div class={POPOVER_CLASS.divider} {...POPOVER_SEPARATOR_ARIA} />
          <div class={POPOVER_CLASS.foot}>{props.footer}</div>
        </>
      ) : null}
    </div>
  );
}

/** A single-select dropdown popover anchored to its own chip trigger. */
export function Popover(props: PopoverProps) {
  const { items, disabled = false } = props;
  const generatedId = useId();
  const ids = popoverIds(props.id ?? generatedId);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPosition>(POPOVER_DEFAULT_POSITION);

  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Row to focus on the next open (-1 ⇒ let `initialPopoverIndex` decide). */
  const pendingFocus = useRef(-1);

  const itemNodes = (): HTMLButtonElement[] =>
    Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-pop-item]") ?? []);

  const focusRow = (i: number) => {
    // preventScroll: a bare focus() asks the browser to reveal the row by scrolling every
    // scrollable ancestor — which yanks the page out from under an open popover.
    itemNodes()[i]?.focus({ preventScroll: true });
  };

  const setOpenState = (next: boolean) => {
    setOpen(next);
    props.onOpenChange?.(next);
  };

  const openAt = (index: number) => {
    if (disabled) return;
    pendingFocus.current = index;
    setPos(POPOVER_DEFAULT_POSITION); // re-measured below; never reuse a stale flip
    setOpenState(true);
  };

  const closeToTrigger = () => {
    setOpenState(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  // Placement: measure once the panel is in the DOM but before paint, so it never flashes at the
  // wrong end of the trigger. Guarded by samePopoverPosition so measure → setState can't loop.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;
      const next = resolvePopoverPosition(
        trigger.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.offsetHeight },
        { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      );
      setPos((prev) => (samePopoverPosition(prev, next) ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    // capture: scroll does not bubble, so this is the only way to see a scrollable ANCESTOR move
    // the anchor and invalidate the flip decision.
    document.addEventListener("scroll", measure, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, { capture: true });
    };
  }, [open, items.length]);

  // a11y: on open, focus moves INTO the menu the role promises — the selected row, else the first
  // enabled one, else the panel itself (an empty or all-disabled list), never left on the trigger.
  useEffect(() => {
    if (!open) return;
    const requested = pendingFocus.current;
    pendingFocus.current = -1;
    const index = requested >= 0 ? requested : initialPopoverIndex(items);
    if (index >= 0) focusRow(index);
    else panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Outside pointerdown closes. Focus is NOT pulled back to the trigger here: the pointer is
  // already establishing focus somewhere else, and stealing it back would fight the user.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) setOpenState(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  // One handler on the anchor catches keys from the trigger AND the panel (both are inside it).
  // The anchor is a plain <div>, but it is never itself focusable or a tab stop — every key this
  // sees has bubbled up from a real <button>, so this is delegation, not a keyboard handler bolted
  // onto a non-interactive element. Enter/Space are absent by design: the trigger is a real
  // <button>, so the browser already synthesises a click from them.
  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      const action = popoverTriggerKeyAction(e.key);
      if (action === null) return;
      e.preventDefault();
      openAt(edgePopoverIndex(items, action === "open-first" ? 1 : -1));
      return;
    }
    const action = popoverPanelKeyAction(e.key);
    if (action === null) return;
    // Tab ("dismiss") must keep its native behaviour or the popover is a focus trap; moving focus
    // to the trigger first makes the browser continue the tab sequence from AFTER the trigger,
    // which is where tabbing out of a menu belongs.
    if (popoverKeyHandled(action)) e.preventDefault();
    if (action === "close" || action === "dismiss") {
      closeToTrigger();
      return;
    }
    const next = resolvePopoverIndex(action, items, itemNodes().indexOf(document.activeElement as HTMLButtonElement));
    if (next >= 0) focusRow(next);
  };

  const text = popoverTriggerText(items, { label: props.label, placeholder: props.placeholder });

  return (
    <div class={POPOVER_CLASS.anchor} ref={anchorRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        class={popoverTriggerClass({ open, disabled })}
        disabled={disabled}
        title={props.triggerTitle}
        {...popoverTriggerAria(open, ids)}
        onClick={() => (open ? closeToTrigger() : openAt(-1))}
      >
        {text.label !== null ? <span class={POPOVER_CLASS.triggerLabel}>{text.label}</span> : null}
        <span class={POPOVER_CLASS.triggerValue}>{text.value}</span>
        <span class={POPOVER_CLASS.triggerCaret} {...POPOVER_DECORATIVE_ARIA}>
          {POPOVER_CARET}
        </span>
      </button>
      {open ? (
        <PopoverPanel
          panelRef={panelRef}
          ids={ids}
          pos={pos}
          items={items}
          title={props.title}
          caption={props.caption}
          footer={props.footer}
          onPick={(item) => {
            closeToTrigger(); // a11y — selecting returns focus to the trigger, never to <body>
            props.onSelect(item.key, item);
          }}
        />
      ) : null}
    </div>
  );
}
