// @mythicalos/react-ui — the dropdown popover (ds/components-popover, registry row `popover` v1).
//
// React twin of packages/preact-ui/src/Popover.tsx: same props, same markup, same behaviour. Like
// its sibling this file is WIRING ONLY — class strings, the viewport-aware flip/align geometry,
// the keyboard grammar, the roving-focus index arithmetic, the trigger's text composition and the
// ARIA maps all come from `@mythicalos/ui-core`, so the two bindings cannot drift.
//
// Preact→React notes (the only deltas, none of them behavioural):
//  · `class` → `className`, `ComponentChildren` → `ReactNode`, `preact/hooks` → `react`.
//  · The measurement effect runs through an isomorphic layout-effect alias. React logs a warning
//    for `useLayoutEffect` during server rendering; Preact does not. The alias keeps the
//    before-paint measurement in the browser (so the panel never flashes at the wrong end of the
//    trigger) without that SSR warning.
//  · React's `useId` produces ids containing `:`. They are only ever used as attribute VALUES
//    (`id` / `aria-controls` / `aria-labelledby`), never inside a CSS selector, so they are safe.
//
// Documented residual (identical to the sibling): placement is re-measured on open, on resize and
// on scroll, but not on a mutation that resizes the open panel itself (no ResizeObserver).
//
// Consumer contract (design card, verbatim): "Ancestors must never clip it."

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, Ref } from "react";
import {
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_CLASS,
  POPOVER_DEFAULT_POSITION,
  edgePopoverIndex,
  initialPopoverIndex,
  popoverIds,
  popoverItemAria,
  popoverItemClass,
  popoverKeyHandled,
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

/** `useLayoutEffect` in the browser, `useEffect` on the server — see the header note. */
const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

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
  footer?: ReactNode;
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
  footer?: ReactNode;
  panelRef?: Ref<HTMLDivElement>;
}

/**
 * The OPEN panel, deliberately hook-free — the React twin of the Preact sibling's `PopoverPanel`,
 * kept for the identical reason: a server-render test can exercise the panel markup (and a row's
 * REAL onClick closure off the returned element tree) without a DOM. Exported from this module for
 * tests; NOT part of the package barrel. `panelRef` rather than `ref` so both bindings expose the
 * same prop name.
 */
export function PopoverPanel(props: PopoverPanelProps) {
  return (
    <div ref={props.panelRef} className={popoverPanelClass(props.pos)} tabIndex={-1} {...popoverPanelAria(props.ids)}>
      {props.title !== undefined || props.caption !== undefined ? (
        <div className={POPOVER_CLASS.head}>
          {props.title !== undefined ? <span className={POPOVER_CLASS.title}>{props.title}</span> : null}
          {props.caption !== undefined ? <span className={POPOVER_CLASS.caption}>{props.caption}</span> : null}
        </div>
      ) : null}
      {props.items.map((item) => (
        <button
          key={item.key}
          type="button"
          data-pop-item=""
          className={popoverItemClass(item)}
          disabled={item.disabled}
          {...popoverItemAria(item)}
          onClick={() => {
            if (item.disabled) return; // belt-and-braces: a native disabled button fires no click
            props.onPick(item);
          }}
        >
          <span className={POPOVER_CLASS.itemLabel}>{item.label}</span>
          <span className={POPOVER_CLASS.itemCheck} aria-hidden="true">
            {item.selected ? POPOVER_CHECK : ""}
          </span>
        </button>
      ))}
      {props.footer !== undefined ? (
        <>
          <div className={POPOVER_CLASS.divider} role="separator" />
          <div className={POPOVER_CLASS.foot}>{props.footer}</div>
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
  useIsomorphicLayoutEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `items` is read at open time only
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setOpenState is stable enough here
  }, [open]);

  // One handler on the anchor catches keys from the trigger AND the panel (both are inside it).
  // The anchor is a plain <div>, but it is never itself focusable or a tab stop — every key this
  // sees has bubbled up from a real <button>, so this is delegation, not a keyboard handler bolted
  // onto a non-interactive element. Enter/Space are absent by design: the trigger is a real
  // <button>, so the browser already synthesises a click from them.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
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
    <div className={POPOVER_CLASS.anchor} ref={anchorRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={popoverTriggerClass({ open, disabled })}
        disabled={disabled}
        title={props.triggerTitle}
        {...popoverTriggerAria(open, ids)}
        onClick={() => (open ? closeToTrigger() : openAt(-1))}
      >
        {text.label !== null ? <span className={POPOVER_CLASS.triggerLabel}>{text.label}</span> : null}
        <span className={POPOVER_CLASS.triggerValue}>{text.value}</span>
        <span className={POPOVER_CLASS.triggerCaret} aria-hidden="true">
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
