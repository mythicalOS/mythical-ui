/** @jsxImportSource preact */
// packages/preact-ui/tags.test.tsx — render contracts for the tags & chips family: Tag, Flag,
// ChipDropdown. Expected class strings and copy are derived by importing the CORE functions and
// constants directly, never hard-coded, so the binding and @mythicalos/ui-core cannot drift.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import {
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  CHIP_DROPDOWN_PARTS,
  FLAG_TONES,
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  TAG_REMOVE_LABEL,
  TAG_SIZES,
  TAG_TONES,
  chipDropdownClass,
  flagClass,
  tagClass,
  tagRemoveLabel,
} from "@mythicalos/ui-core/logic";
import { ChipDropdown, Flag, Tag } from "./src/index.ts";

describe("Tag", () => {
  test("tone × size → class is tagClass(...), verbatim, across the whole matrix", () => {
    for (const tone of TAG_TONES) {
      expect(renderToString(<Tag tone={tone}>x</Tag>)).toContain(`class="${tagClass(tone)} "`);
      for (const size of TAG_SIZES) {
        expect(renderToString(<Tag tone={tone} size={size}>x</Tag>)).toContain(
          `class="${tagClass(tone, { size })} "`,
        );
      }
    }
  });

  test("the default is the accent tone at the default step", () => {
    expect(renderToString(<Tag>x</Tag>)).toContain(`class="${tagClass()} "`);
  });

  test("the tag itself is NEVER interactive — no role, no tabindex, no button element", () => {
    const html = renderToString(<Tag tone="ok">live</Tag>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("<button");
  });

  test("the dot renders only when asked, and never replaces the word (token rule #7)", () => {
    expect(renderToString(<Tag dot>live</Tag>)).toContain(`class="${TAG_PARTS.dot}"`);
    expect(renderToString(<Tag dot>live</Tag>)).toContain("live");
    expect(renderToString(<Tag>live</Tag>)).not.toContain(TAG_PARTS.dot);
  });

  test("the count renders a real number — including 0 — and nothing else", () => {
    expect(renderToString(<Tag count={248}>records</Tag>)).toContain(
      `<span class="${TAG_PARTS.num}">248</span>`,
    );
    // 0 is a genuinely reported count, not an absence: it must survive the guard.
    expect(renderToString(<Tag count={0}>conflicts</Tag>)).toContain(
      `<span class="${TAG_PARTS.num}">0</span>`,
    );
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(renderToString(<Tag count={bad}>records</Tag>)).not.toContain(TAG_PARTS.num);
    }
    // A non-number from a JS consumer is not a count either — it must not reach the DOM.
    expect(renderToString(<Tag count={"12" as unknown as number}>records</Tag>)).not.toContain(
      TAG_PARTS.num,
    );
  });

  test("the × appears only with onRemove, as a real focusable button with an accessible name", () => {
    const html = renderToString(
      <Tag onRemove={() => {}} removeName="reviewed">
        reviewed
      </Tag>,
    );
    expect(html).toContain(`<button type="button" class="${TAG_PARTS.remove}"`);
    expect(html).toContain(`aria-label="${tagRemoveLabel("reviewed")}"`);
    expect(html).toContain(TAG_REMOVE_GLYPH);
    expect(renderToString(<Tag>reviewed</Tag>)).not.toContain(TAG_PARTS.remove);
  });

  test("an unnamed × is announced as the bare label, never a guessed subject", () => {
    const html = renderToString(<Tag onRemove={() => {}}>reviewed</Tag>);
    expect(html).toContain(`aria-label="${TAG_REMOVE_LABEL}"`);
  });

  test("rendering never invokes onRemove — only a real activation may", () => {
    let calls = 0;
    renderToString(<Tag onRemove={() => (calls += 1)}>x</Tag>);
    expect(calls).toBe(0);
  });

  test("the passthrough class is appended, never replaced", () => {
    expect(renderToString(<Tag tone="warn" class="extra">x</Tag>)).toContain(
      `class="${tagClass("warn")} extra"`,
    );
  });
});

describe("Flag", () => {
  test("tone → class is flagClass(tone), verbatim, for every tone", () => {
    for (const tone of FLAG_TONES) {
      expect(renderToString(<Flag tone={tone}>M</Flag>)).toContain(`class="${flagClass(tone)} "`);
    }
    expect(renderToString(<Flag>M</Flag>)).toContain(`class="${flagClass()} "`);
  });

  test("the caller's text is rendered verbatim — case is a machine fact, not a style", () => {
    expect(renderToString(<Flag>clean ✓</Flag>)).toContain("clean ✓");
    expect(renderToString(<Flag tone="neutral">NOTE</Flag>)).toContain("NOTE");
  });

  test("a flag is non-interactive", () => {
    const html = renderToString(<Flag tone="warn">M</Flag>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("role=");
  });
});

describe("ChipDropdown", () => {
  test("state → class is chipDropdownClass(...), verbatim", () => {
    expect(renderToString(<ChipDropdown value="v" />)).toContain(`class="${chipDropdownClass()} "`);
    expect(renderToString(<ChipDropdown value="v" selected />)).toContain(
      `class="${chipDropdownClass({ selected: true })} "`,
    );
  });

  test("it is a real button, with the value and the decorative caret", () => {
    const html = renderToString(<ChipDropdown label="model" value="sonnet-4.6" />);
    expect(html).toContain('<button type="button"');
    expect(html).toContain("model");
    expect(html).toContain(`<span class="${CHIP_DROPDOWN_PARTS.value}">sonnet-4.6</span>`);
    expect(html).toContain(
      `<span class="${CHIP_DROPDOWN_PARTS.caret}" aria-hidden="true">${CHIP_DROPDOWN_CARET}</span>`,
    );
  });

  test("an absent value renders the honest em dash, never an empty slot", () => {
    for (const value of [undefined, "", "   "]) {
      expect(renderToString(<ChipDropdown label="branch" value={value} />)).toContain(
        `<span class="${CHIP_DROPDOWN_PARTS.value}">${CHIP_DROPDOWN_EMPTY_VALUE}</span>`,
      );
    }
  });

  test("disabled is ANNOUNCED (aria-disabled) and the handler is detached, not just repainted", () => {
    const html = renderToString(<ChipDropdown value="main" disabled onClick={() => {}} />);
    expect(html).toContain('aria-disabled="true"');
    // The class must not carry the disabled state: painting it without announcing it is exactly
    // the dishonest half-state this split prevents.
    expect(html).toContain(`class="${chipDropdownClass()} "`);
    expect(renderToString(<ChipDropdown value="main" />)).not.toContain("aria-disabled");
  });

  test("disabled DETACHES the handler — the chip is inert, not merely repainted", () => {
    // There is no DOM in this package's bun:test environment, so the vnode's props are inspected
    // directly: that IS the wiring a click would travel through.
    let calls = 0;
    const bump = () => (calls += 1);

    const enabled = ChipDropdown({ value: "main", onClick: bump }) as {
      props: Record<string, unknown>;
    };
    expect(typeof enabled.props.onClick).toBe("function");
    (enabled.props.onClick as () => void)();
    expect(calls).toBe(1);

    const disabled = ChipDropdown({ value: "main", disabled: true, onClick: bump }) as {
      props: Record<string, unknown>;
    };
    expect(disabled.props.onClick).toBeUndefined();
    expect(disabled.props["aria-disabled"]).toBe("true");
    expect(calls).toBe(1); // untouched — a disabled chip cannot fire

    // …and it stays focusable/announced rather than dropping out of the tab order.
    expect(disabled.props.disabled).toBeUndefined();
  });
});
