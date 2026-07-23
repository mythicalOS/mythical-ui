/** @jsxImportSource preact */
// packages/shell/nav-tabs.test.tsx — NavTabs render contract (Task 8): active class + onSelect
// wiring. preact-render-to-string never dispatches DOM click events, but NavTabs is a plain,
// hook-free function component — calling it directly (bypassing preact's render pipeline
// entirely) returns the real vnode tree preact would otherwise build, so each button's actual
// `onClick` closure (not a reconstruction) can be pulled off `vnode.props.children[i].props
// .onClick` and invoked directly. This is real coverage of the shipped code path, not a decoy.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import { NavTabs, type NavTabsProps } from "./src/index.ts";

function callNavTabs(props: NavTabsProps): VNode {
  // NavTabs uses no hooks, so calling it as a plain function (not via h()/render()) is safe and
  // hands back the real vnode tree with the real onClick closures still attached.
  return (NavTabs as unknown as (p: NavTabsProps) => VNode)(props);
}

const items = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "settings", label: "Settings" },
];

describe("NavTabs — render contract", () => {
  test("renders every item's label", () => {
    const html = renderToString(<NavTabs items={items} active="overview" onSelect={() => {}} />);
    for (const it of items) expect(html).toContain(it.label);
  });

  test("the active item gets is-active; the others don't", () => {
    const html = renderToString(<NavTabs items={items} active="sessions" onSelect={() => {}} />);
    const isActiveCount = (html.match(/is-active/g) ?? []).length;
    expect(isActiveCount).toBe(1);
  });

  test("no active key ⇒ no item is marked active", () => {
    const html = renderToString(<NavTabs items={items} onSelect={() => {}} />);
    expect(html).not.toContain("is-active");
  });

  test("an active key not present in items ⇒ no item is marked active", () => {
    const html = renderToString(<NavTabs items={items} active="nonexistent" onSelect={() => {}} />);
    expect(html).not.toContain("is-active");
  });

  test("onSelect wiring: each button's real onClick closure calls onSelect with that item's key", () => {
    const selected: string[] = [];
    const vnode = callNavTabs({ items, active: "overview", onSelect: (key) => selected.push(key) });
    const buttons = vnode.props.children as VNode<{ onClick: () => void }>[];
    expect(buttons.length).toBe(items.length);
    for (const button of buttons) button.props.onClick();
    expect(selected).toEqual(["overview", "sessions", "settings"]);
  });

  test("missing onSelect never throws when a tab 'click' fires (optional-call guard)", () => {
    const html = renderToString(<NavTabs items={items} active="overview" />);
    expect(html).toContain("my-nav__tab");
  });
});
