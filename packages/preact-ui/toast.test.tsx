/** @jsxImportSource preact */
// packages/preact-ui/toast.test.tsx — the toast binding's contract: it renders what the shared
// stack view says, and every affordance it draws is wired to a real caller.
//
// The behaviour itself (which tone expires when, the hover hold, the collapse arithmetic) belongs
// to `@mythicalos/ui-core` and is unit-tested there against a clock a test controls — none of it
// is re-tested here. What IS package-specific, and is what this file proves, is the wiring: that
// this binding derives its render from `toastStackView`/`ToastStack.view()` instead of slicing its
// own list, and that the "+n more" collapse, the close button and the hover/focus hold each reach
// a callback rather than being decoration.
//
// Depth note: this package's bun:test environment has no DOM (see hooks.test.ts), so a mounted
// provider cannot be clicked. Two techniques stand in, and between them they cover both halves:
// `renderToString` for the MARKUP (classes, aria, which toasts are on screen), and calling the
// hook-free `ToastStackBody` directly to get its vnode tree, whose handler props are real
// functions this test invokes. A serialized render alone would prove nothing about wiring —
// preact-render-to-string drops every handler.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  TOAST_COLLAPSE_LABEL,
  TOAST_MAX_VISIBLE,
  toastStackView,
  type LiveToast,
} from "@mythicalos/ui-core/logic";
import { Toast, ToastProvider } from "./src/index.ts";
// Not on the barrel — the provider's hook-free body, the only way to render a populated stack
// without a DOM to push into (same pattern as InputBody in input-reveal.test.tsx).
import { ToastStackBody } from "./src/Toast.tsx";

const noop = () => {};

function toasts(count: number): LiveToast[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    status: i % 2 === 0 ? ("error" as const) : ("ok" as const),
    title: `toast ${i + 1}`,
  }));
}

type StackProps = Parameters<typeof ToastStackBody>[0];

function propsFor(count: number, expanded: boolean, handlers: Partial<StackProps> = {}): StackProps {
  return {
    view: toastStackView(toasts(count), expanded),
    onDismiss: handlers.onDismiss ?? noop,
    onToggleExpanded: handlers.onToggleExpanded ?? noop,
    onPause: handlers.onPause ?? noop,
  };
}

/** The element, for a serialized render. */
function body(count: number, expanded: boolean, handlers: Partial<StackProps> = {}) {
  return <ToastStackBody {...propsFor(count, expanded, handlers)} />;
}

describe("the stack renders exactly what the shared view says", () => {
  test("an empty stack is an empty live region — no toast, no collapse control", () => {
    const html = renderToString(body(0, false));
    expect(html).toContain('class="toast-stack"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("toast-more");
    expect(html).not.toContain("toast--");
  });

  test("at the cap: every toast renders and there is still no control", () => {
    const html = renderToString(body(TOAST_MAX_VISIBLE, false));
    for (let i = 1; i <= TOAST_MAX_VISIBLE; i++) expect(html).toContain(`toast ${i}`);
    expect(html).not.toContain("toast-more");
  });

  test("over the cap, collapsed: the newest few render and the rest are behind a real BUTTON", () => {
    const html = renderToString(body(5, false));
    expect(html).not.toContain("toast 1");
    expect(html).not.toContain("toast 2");
    for (const t of ["toast 3", "toast 4", "toast 5"]) expect(html).toContain(t);
    expect(html).toContain("+2 more");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*class="toast-more"/);
    expect(html).toContain('aria-expanded="false"');
  });

  test("expanded: every held toast is on screen and the control offers the way back", () => {
    const html = renderToString(body(5, true));
    for (let i = 1; i <= 5; i++) expect(html).toContain(`toast ${i}`);
    expect(html).toContain(TOAST_COLLAPSE_LABEL);
    expect(html).not.toContain("more</button>");
    expect(html).toContain('aria-expanded="true"');
  });

  test("the count is the stack's own, at any depth", () => {
    expect(renderToString(body(12, false))).toContain(`+${12 - TOAST_MAX_VISIBLE} more`);
  });
});

/** Every vnode in the tree, so a control can be found by what it IS, not by child index. */
function walk(node: unknown): any[] {
  if (node === null || typeof node !== "object") return [];
  const vnode = node as { props?: { children?: unknown } };
  const children = vnode.props?.children;
  const list = Array.isArray(children) ? children.flat(Infinity) : children === undefined ? [] : [children];
  return [vnode, ...list.flatMap(walk)];
}

/** The component's OWN output (it is hook-free, so calling it is legitimate), flattened. */
function tree(count: number, expanded: boolean, handlers: Partial<StackProps> = {}): any[] {
  return walk(ToastStackBody(propsFor(count, expanded, handlers)));
}

describe("every affordance the stack draws reaches a real caller", () => {
  test("the collapse control's click toggles the stack — it is not decoration", () => {
    const toggled: number[] = [];
    const nodes = tree(5, false, { onToggleExpanded: () => toggled.push(1) });
    const control = nodes.find((n) => n.type === "button" && n.props.class === "toast-more");
    expect(control).toBeDefined();
    expect(typeof control.props.onClick).toBe("function");
    control.props.onClick();
    expect(toggled).toEqual([1]);
  });

  test("each toast's close reaches dismiss with ITS id — not the neighbour's", () => {
    const dismissed: number[] = [];
    const nodes = tree(5, true, { onDismiss: (id: number) => dismissed.push(id) });
    const rendered = nodes.filter((n) => n.type === Toast);
    expect(rendered).toHaveLength(5);
    for (const t of rendered) t.props.onClose();
    expect(dismissed).toEqual([1, 2, 3, 4, 5]);
  });

  test("pointer in/out and focus in/out hold and release the deadlines", () => {
    const holds: boolean[] = [];
    const nodes = tree(1, false, { onPause: (paused: boolean) => holds.push(paused) });
    const stackEl = nodes.find((n) => n.type === "div" && n.props.class === "toast-stack");
    expect(stackEl).toBeDefined();
    stackEl.props.onMouseEnter();
    stackEl.props.onFocusCapture();
    stackEl.props.onBlurCapture();
    stackEl.props.onMouseLeave();
    expect(holds).toEqual([true, true, false, false]);
  });

  test("focus is watched in the CAPTURE phase — focus/blur do not bubble to the stack", () => {
    const nodes = tree(1, false);
    const stackEl = nodes.find((n) => n.type === "div" && n.props.class === "toast-stack");
    expect(typeof stackEl.props.onFocusCapture).toBe("function");
    expect(typeof stackEl.props.onBlurCapture).toBe("function");
    expect(stackEl.props.onFocus).toBeUndefined();
    expect(stackEl.props.onBlur).toBeUndefined();
  });

  test("the provider mounts the stack around its children and pushes nothing on its own", () => {
    const html = renderToString(
      <ToastProvider>
        <span>app</span>
      </ToastProvider>,
    );
    expect(html).toContain("<span>app</span>");
    expect(html).toContain('class="toast-stack"');
    expect(html).not.toContain("toast-more");
  });
});

describe("the dismiss policy is imported, never re-declared here (source scan)", () => {
  // Comment-stripped, for the reason hooks.test.ts states: a commented-out old table would
  // otherwise satisfy — or trip — these scans while the live code did the opposite.
  const source = readFileSync(join(import.meta.dir, "src", "Toast.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  test("the scan is looking at real code (guards the guard)", () => {
    expect(source).toContain("export function ToastProvider");
    expect(source.length).toBeGreaterThan(500);
  });

  test("no local dismiss table, and no duration literal anywhere in the binding", () => {
    expect(source).not.toContain("DISMISS_MS");
    expect(source).not.toMatch(/\b(2600|4000|8000)\b/);
  });

  test("the stack's state and clock come from the core — this file arms no timer of its own", () => {
    expect(source).toMatch(/from\s+["']@mythicalos\/ui-core\/logic["']/);
    expect(source).toContain("createToastStack(");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("clearTimeout");
  });

  test("the rendered list is the shared view, not a slice this file invents", () => {
    expect(source).toContain("stack.view()");
    expect(source).not.toContain(".slice(-");
  });
});
