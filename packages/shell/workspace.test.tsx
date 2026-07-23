/** @jsxImportSource preact */
// packages/shell/workspace.test.tsx — WorkspaceSplit + Rail* render contract (Task 8): rail/detail
// structure and RailCard state classes. RailCard and RailGroup/RailHead/RailList are all
// hook-free, so onClick wiring is verified by invoking the real closure directly off the vnode
// (same technique as nav-tabs.test.tsx), not a simulated DOM click.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import {
  RailCard,
  RailGroup,
  RailHead,
  RailList,
  WorkspaceSplit,
  type RailCardProps,
} from "./src/index.ts";

function callRailCard(props: RailCardProps): VNode<{ onClick?: () => void }> {
  return (RailCard as unknown as (p: RailCardProps) => VNode<{ onClick?: () => void }>)(props);
}

describe("WorkspaceSplit — rail/detail structure", () => {
  test("Rail and Detail render inside the split container", () => {
    const html = renderToString(
      <WorkspaceSplit>
        <WorkspaceSplit.Rail>rail content</WorkspaceSplit.Rail>
        <WorkspaceSplit.Detail>detail content</WorkspaceSplit.Detail>
      </WorkspaceSplit>,
    );
    expect(html).toContain("my-split");
    expect(html).toContain("my-split__rail");
    expect(html).toContain("rail content");
    expect(html).toContain("my-split__detail");
    expect(html).toContain("detail content");
  });
});

describe("RailHead / RailList / RailGroup — structural render", () => {
  test("RailHead renders title, optional subtitle, and the action slot", () => {
    const html = renderToString(<RailHead title="Sessions" subtitle="12 active" action={<button>+</button>} />);
    expect(html).toContain("my-rail__head");
    expect(html).toContain("my-rail__title");
    expect(html).toContain("Sessions");
    expect(html).toContain("my-rail__subtitle");
    expect(html).toContain("12 active");
  });

  test("RailHead with no subtitle renders no subtitle element", () => {
    const html = renderToString(<RailHead title="Sessions" />);
    expect(html).not.toContain("my-rail__subtitle");
  });

  test("RailList wraps children in the scrolling list body", () => {
    const html = renderToString(<RailList>items here</RailList>);
    expect(html).toContain("my-rail__list");
    expect(html).toContain("items here");
  });

  test("RailGroup renders an optional label and its children", () => {
    const html = renderToString(<RailGroup label="Today">a card</RailGroup>);
    expect(html).toContain("my-rail__group");
    expect(html).toContain("my-rail__group-label");
    expect(html).toContain("Today");
    expect(html).toContain("a card");
  });

  test("RailGroup with no label renders no group-label element", () => {
    const html = renderToString(<RailGroup>a card</RailGroup>);
    expect(html).not.toContain("my-rail__group-label");
  });
});

describe("RailCard — state classes", () => {
  test("default state has no is-active/is-warn modifier", () => {
    const html = renderToString(<RailCard>item</RailCard>);
    expect(html).toContain("my-rail-card");
    expect(html).not.toContain("is-active");
    expect(html).not.toContain("is-warn");
  });

  test("state='active' adds is-active", () => {
    const html = renderToString(<RailCard state="active">item</RailCard>);
    expect(html).toContain("my-rail-card is-active");
  });

  test("state='warn' adds is-warn", () => {
    const html = renderToString(<RailCard state="warn">item</RailCard>);
    expect(html).toContain("my-rail-card is-warn");
  });

  test("onClick wiring: the real onClick closure invokes the caller's handler", () => {
    let clicked = false;
    const vnode = callRailCard({ onClick: () => (clicked = true), children: "item" });
    expect(typeof vnode.props.onClick).toBe("function");
    vnode.props.onClick!();
    expect(clicked).toBe(true);
  });

  test("no onClick supplied ⇒ never throws when rendered", () => {
    const html = renderToString(<RailCard>item</RailCard>);
    expect(html).toContain("my-rail-card");
  });
});
