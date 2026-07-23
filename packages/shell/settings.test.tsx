/** @jsxImportSource preact */
// packages/shell/settings.test.tsx — SettingsLayout/SettingsNav render contract (Task 8): active
// item, footer slot, and onSelect wiring (real closure invocation, same technique as
// nav-tabs.test.tsx — SettingsNav is hook-free).

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import { SettingsLayout, SettingsNav, type SettingsNavProps } from "./src/index.ts";

function callSettingsNav(props: SettingsNavProps): VNode {
  return (SettingsNav as unknown as (p: SettingsNavProps) => VNode)(props);
}

const items = [
  { key: "profile", label: "Profile" },
  { key: "billing", label: "Billing" },
];

describe("SettingsLayout — structure", () => {
  test("renders the nav slot and wraps children in the detail pane", () => {
    const html = renderToString(
      <SettingsLayout nav={<nav class="my-settings__nav">nav slot</nav>}>detail content</SettingsLayout>,
    );
    expect(html).toContain("my-split");
    expect(html).toContain("nav slot");
    expect(html).toContain("my-settings__detail");
    expect(html).toContain("detail content");
  });
});

describe("SettingsNav — render contract", () => {
  test("renders every item's label", () => {
    const html = renderToString(<SettingsNav items={items} active="profile" onSelect={() => {}} />);
    for (const it of items) expect(html).toContain(it.label);
  });

  test("the active item gets is-active; the others don't", () => {
    const html = renderToString(<SettingsNav items={items} active="billing" onSelect={() => {}} />);
    const isActiveCount = (html.match(/is-active/g) ?? []).length;
    expect(isActiveCount).toBe(1);
  });

  test("no active key ⇒ no item is marked active", () => {
    const html = renderToString(<SettingsNav items={items} onSelect={() => {}} />);
    expect(html).not.toContain("is-active");
  });

  test("the footer slot renders after the item list", () => {
    const html = renderToString(
      <SettingsNav items={items} active="profile" onSelect={() => {}} footer={<div class="my-eyebrow">v0.1.0</div>} />,
    );
    expect(html).toContain("v0.1.0");
    expect(html.indexOf(items[1]!.label)).toBeLessThan(html.indexOf("v0.1.0"));
  });

  test("no footer supplied ⇒ renders cleanly with nothing extra", () => {
    const html = renderToString(<SettingsNav items={items} active="profile" onSelect={() => {}} />);
    expect(html).toContain("my-settings__nav");
  });

  test("onSelect wiring: each item's real onClick closure calls onSelect with that item's key", () => {
    const selected: string[] = [];
    const vnode = callSettingsNav({ items, active: "profile", onSelect: (key) => selected.push(key) });
    // SettingsNav has two sibling child expressions (`{items.map(...)}` then `{footer}`), so
    // preact's children are `[itemButtonsArray, footer]` — not a flat list. The item buttons are
    // the first entry.
    const children = vnode.props.children as [VNode<{ onClick: () => void }>[], unknown];
    const buttons = children[0];
    expect(buttons.length).toBe(items.length);
    for (const button of buttons) button.props.onClick();
    expect(selected).toEqual(["profile", "billing"]);
  });
});
