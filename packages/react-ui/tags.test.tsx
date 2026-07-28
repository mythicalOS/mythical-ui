// packages/react-ui/tags.test.tsx — React twin of packages/preact-ui/tags.test.tsx. Same
// assertions, same core-derived expectations: Tag/Flag/ChipDropdown must derive 100% of their
// class strings and copy from `@mythicalos/ui-core/logic`, so the two bindings cannot drift.
// (See parity.test.tsx for why side-by-side rendering of both bindings in one process is not
// possible — the guarantee is "both call the same core function", asserted on both sides.)

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
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
  tagCountText,
  tagRemoveLabel,
} from "@mythicalos/ui-core/logic";
import { ChipDropdown, Flag, Tag } from "./src/index.ts";

describe("Tag", () => {
  test("tone × size → class is tagClass(...), verbatim, across the whole matrix", () => {
    for (const tone of TAG_TONES) {
      expect(renderToStaticMarkup(<Tag tone={tone}>x</Tag>)).toContain(`class="${tagClass(tone)} "`);
      for (const size of TAG_SIZES) {
        expect(renderToStaticMarkup(<Tag tone={tone} size={size}>x</Tag>)).toContain(
          `class="${tagClass(tone, { size })} "`,
        );
      }
    }
  });

  test("the default is the accent tone at the default step", () => {
    expect(renderToStaticMarkup(<Tag>x</Tag>)).toContain(`class="${tagClass()} "`);
  });

  test("the tag itself is NEVER interactive — no role, no tabindex, no button element", () => {
    const html = renderToStaticMarkup(<Tag tone="ok">live</Tag>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("<button");
  });

  test("the dot renders only when asked, and never replaces the word (token rule #7)", () => {
    expect(renderToStaticMarkup(<Tag dot>live</Tag>)).toContain(`class="${TAG_PARTS.dot}"`);
    expect(renderToStaticMarkup(<Tag dot>live</Tag>)).toContain("live");
    expect(renderToStaticMarkup(<Tag>live</Tag>)).not.toContain(TAG_PARTS.dot);
  });

  test("the count is exactly what tagCountText admits — the core owns the guard", () => {
    expect(renderToStaticMarkup(<Tag count={248}>records</Tag>)).toContain(
      `<span class="${TAG_PARTS.num}">${tagCountText(248)}</span>`,
    );
    // 0 is a genuinely reported count, not an absence: it must survive the guard.
    expect(renderToStaticMarkup(<Tag count={0}>conflicts</Tag>)).toContain(
      `<span class="${TAG_PARTS.num}">0</span>`,
    );
    // Malformed data is DROPPED, never rendered as a count the caller never measured — a
    // fraction is not a number of records and a negative is not a number of anything.
    for (const bad of [undefined, NaN, Infinity, -Infinity, -1, 1.5]) {
      expect({ bad, html: renderToStaticMarkup(<Tag count={bad}>records</Tag>) }).toEqual({
        bad,
        html: renderToStaticMarkup(<Tag>records</Tag>),
      });
    }
    // A non-number from a JS consumer is not a count either — it must not reach the DOM.
    expect(renderToStaticMarkup(<Tag count={"12" as unknown as number}>records</Tag>)).not.toContain(
      TAG_PARTS.num,
    );
  });

  test("the × appears only with onRemove, as a real focusable button with an accessible name", () => {
    const html = renderToStaticMarkup(
      <Tag onRemove={() => {}} removeName="reviewed">
        reviewed
      </Tag>,
    );
    expect(html).toContain(`<button type="button" class="${TAG_PARTS.remove}"`);
    expect(html).toContain(`aria-label="${tagRemoveLabel("reviewed")}"`);
    expect(html).toContain(TAG_REMOVE_GLYPH);
    expect(renderToStaticMarkup(<Tag>reviewed</Tag>)).not.toContain(TAG_PARTS.remove);
  });

  test("an unnamed × is announced as the bare label, never a guessed subject", () => {
    const html = renderToStaticMarkup(<Tag onRemove={() => {}}>reviewed</Tag>);
    expect(html).toContain(`aria-label="${TAG_REMOVE_LABEL}"`);
  });

  test("rendering never invokes onRemove — only a real activation may", () => {
    let calls = 0;
    renderToStaticMarkup(<Tag onRemove={() => (calls += 1)}>x</Tag>);
    expect(calls).toBe(0);
  });

  test("the passthrough class is appended, never replaced", () => {
    expect(renderToStaticMarkup(<Tag tone="warn" className="extra">x</Tag>)).toContain(
      `class="${tagClass("warn")} extra"`,
    );
  });
});

describe("Flag", () => {
  test("tone → class is flagClass(tone), verbatim, for every tone", () => {
    for (const tone of FLAG_TONES) {
      expect(renderToStaticMarkup(<Flag tone={tone}>M</Flag>)).toContain(`class="${flagClass(tone)} "`);
    }
    expect(renderToStaticMarkup(<Flag>M</Flag>)).toContain(`class="${flagClass()} "`);
  });

  test("the caller's text is rendered verbatim — case is a machine fact, not a style", () => {
    expect(renderToStaticMarkup(<Flag>clean ✓</Flag>)).toContain("clean ✓");
    expect(renderToStaticMarkup(<Flag tone="neutral">NOTE</Flag>)).toContain("NOTE");
  });

  test("a flag is non-interactive", () => {
    const html = renderToStaticMarkup(<Flag tone="warn">M</Flag>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("role=");
  });
});

describe("ChipDropdown", () => {
  test("state → class is chipDropdownClass(...), verbatim", () => {
    expect(renderToStaticMarkup(<ChipDropdown value="v" />)).toContain(`class="${chipDropdownClass()} "`);
    expect(renderToStaticMarkup(<ChipDropdown value="v" selected />)).toContain(
      `class="${chipDropdownClass({ selected: true })} "`,
    );
  });

  test("it is a real button, with the value and the decorative caret", () => {
    const html = renderToStaticMarkup(<ChipDropdown label="model" value="sonnet-4.6" />);
    expect(html).toContain('<button type="button"');
    expect(html).toContain("model");
    expect(html).toContain(`<span class="${CHIP_DROPDOWN_PARTS.value}">sonnet-4.6</span>`);
    expect(html).toContain(
      `<span class="${CHIP_DROPDOWN_PARTS.caret}" aria-hidden="true">${CHIP_DROPDOWN_CARET}</span>`,
    );
  });

  test("an absent value renders the honest em dash, never an empty slot", () => {
    for (const value of [undefined, "", "   "]) {
      expect(renderToStaticMarkup(<ChipDropdown label="branch" value={value} />)).toContain(
        `<span class="${CHIP_DROPDOWN_PARTS.value}">${CHIP_DROPDOWN_EMPTY_VALUE}</span>`,
      );
    }
  });

  test("disabled is ANNOUNCED (aria-disabled) and the handler is detached, not just repainted", () => {
    const html = renderToStaticMarkup(<ChipDropdown value="main" disabled onClick={() => {}} />);
    expect(html).toContain('aria-disabled="true"');
    // The class must not carry the disabled state: painting it without announcing it is exactly
    // the dishonest half-state this split prevents.
    expect(html).toContain(`class="${chipDropdownClass()} "`);
    expect(renderToStaticMarkup(<ChipDropdown value="main" />)).not.toContain("aria-disabled");
  });

  test("disabled SUPPRESSES the activation — inert AND non-bubbling, not merely repainted", () => {
    // There is no DOM in this package's bun:test environment, so the element's own click handler
    // is invoked with a stub event: that IS the wiring a real click would travel through.
    let calls = 0;
    const bump = () => (calls += 1);
    const stub = () => {
      const seen = { prevented: 0, stopped: 0 };
      return {
        seen,
        event: {
          preventDefault: () => void (seen.prevented += 1),
          stopPropagation: () => void (seen.stopped += 1),
        },
      };
    };

    const enabled = ChipDropdown({ value: "main", onClick: bump }) as {
      props: Record<string, unknown>;
    };
    const a = stub();
    (enabled.props.onClick as (e: unknown) => void)(a.event);
    expect(calls).toBe(1);
    expect(a.seen).toEqual({ prevented: 0, stopped: 0 });

    const disabled = ChipDropdown({ value: "main", disabled: true, onClick: bump }) as {
      props: Record<string, unknown>;
    };
    expect(disabled.props["aria-disabled"]).toBe("true");
    const b = stub();
    (disabled.props.onClick as (e: unknown) => void)(b.event);
    expect(calls).toBe(1); // untouched — a disabled chip cannot fire
    // …and the click is stopped, so an ancestor row handler never sees it either.
    expect(b.seen).toEqual({ prevented: 1, stopped: 1 });

    // It stays focusable/announced rather than dropping out of the tab order.
    expect(disabled.props.disabled).toBeUndefined();
  });
});
