/** @jsxImportSource preact */
// packages/preact-ui/chip-family.test.tsx — render contracts for the chip family: Chip, ChipFlag,
// ChipDropdown. Expected class strings and copy are derived by importing the CORE functions and
// constants directly, never hard-coded, so the binding and @mythicalos/ui-core cannot drift.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  CHIP_DROPDOWN_PARTS,
  CHIP_FLAG_TONES,
  CHIP_PARTS,
  CHIP_REMOVE_GLYPH,
  CHIP_REMOVE_LABEL,
  CHIP_SIZES,
  CHIP_TONES,
  chipClass,
  chipCountText,
  chipDropdownClass,
  chipFlagClass,
  chipRemoveLabel,
} from "@mythicalos/ui-core/logic";
import { Chip, ChipDropdown, ChipFlag } from "./src/index.ts";

describe("Chip", () => {
  test("tone × size → class is chipClass(...), verbatim, across the whole matrix", () => {
    for (const tone of CHIP_TONES) {
      expect(renderToString(<Chip tone={tone}>x</Chip>)).toContain(`class="${chipClass(tone)} "`);
      for (const size of CHIP_SIZES) {
        expect(renderToString(<Chip tone={tone} size={size}>x</Chip>)).toContain(
          `class="${chipClass(tone, { size })} "`,
        );
      }
    }
  });

  test("the default is the NEUTRAL tone at the default step", () => {
    // The resting chip is the quiet neutral fill, not the accent.
    expect(renderToString(<Chip>x</Chip>)).toContain(`class="${chipClass()} "`);
    expect(renderToString(<Chip>x</Chip>)).toContain(`class="my-chip "`);
  });

  test("the chip itself is NEVER interactive — no role, no tabindex, no button element", () => {
    const html = renderToString(<Chip tone="ok">live</Chip>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("tabindex");
    expect(html).not.toContain("<button");
  });

  test("the dot renders only when asked, and never replaces the word (token rule #7)", () => {
    expect(renderToString(<Chip dot>live</Chip>)).toContain(`class="${CHIP_PARTS.dot}"`);
    expect(renderToString(<Chip dot>live</Chip>)).toContain("live");
    expect(renderToString(<Chip>live</Chip>)).not.toContain(CHIP_PARTS.dot);
  });

  test("the count is exactly what chipCountText admits — the core owns the guard", () => {
    expect(renderToString(<Chip count={248}>records</Chip>)).toContain(
      `<span class="${CHIP_PARTS.num}">${chipCountText(248)}</span>`,
    );
    // 0 is a genuinely reported count, not an absence: it must survive the guard.
    expect(renderToString(<Chip count={0}>conflicts</Chip>)).toContain(
      `<span class="${CHIP_PARTS.num}">0</span>`,
    );
    // Malformed data is DROPPED, never rendered as a count the caller never measured — a
    // fraction is not a number of records and a negative is not a number of anything.
    for (const bad of [undefined, NaN, Infinity, -Infinity, -1, 1.5]) {
      expect({ bad, html: renderToString(<Chip count={bad}>records</Chip>) }).toEqual({
        bad,
        html: renderToString(<Chip>records</Chip>),
      });
    }
    // A non-number from a JS consumer is not a count either — it must not reach the DOM.
    expect(renderToString(<Chip count={"12" as unknown as number}>records</Chip>)).not.toContain(
      CHIP_PARTS.num,
    );
  });

  test("the × appears only with onRemove, as a real focusable button with an accessible name", () => {
    const html = renderToString(
      <Chip onRemove={() => {}} removeName="reviewed">
        reviewed
      </Chip>,
    );
    expect(html).toContain(`<button type="button" class="${CHIP_PARTS.remove}"`);
    expect(html).toContain(`aria-label="${chipRemoveLabel("reviewed")}"`);
    expect(html).toContain(CHIP_REMOVE_GLYPH);
    expect(renderToString(<Chip>reviewed</Chip>)).not.toContain(CHIP_PARTS.remove);
  });

  test("an unnamed × is announced as the bare label, never a guessed subject", () => {
    const html = renderToString(<Chip onRemove={() => {}}>reviewed</Chip>);
    expect(html).toContain(`aria-label="${CHIP_REMOVE_LABEL}"`);
  });

  test("rendering never invokes onRemove — only a real activation may", () => {
    let calls = 0;
    renderToString(<Chip onRemove={() => (calls += 1)}>x</Chip>);
    expect(calls).toBe(0);
  });

  test("the passthrough class is appended, never replaced", () => {
    expect(renderToString(<Chip tone="warn" class="extra">x</Chip>)).toContain(
      `class="${chipClass("warn")} extra"`,
    );
  });
});

describe("ChipFlag", () => {
  test("tone → class is chipFlagClass(tone), verbatim, for every tone", () => {
    for (const tone of CHIP_FLAG_TONES) {
      expect(renderToString(<ChipFlag tone={tone}>M</ChipFlag>)).toContain(
        `class="${chipFlagClass(tone)} "`,
      );
    }
    expect(renderToString(<ChipFlag>M</ChipFlag>)).toContain(`class="${chipFlagClass()} "`);
  });

  test("the caller's text is rendered verbatim — case is a machine fact, not a style", () => {
    expect(renderToString(<ChipFlag>clean ✓</ChipFlag>)).toContain("clean ✓");
    expect(renderToString(<ChipFlag tone="neutral">NOTE</ChipFlag>)).toContain("NOTE");
  });

  test("a flag is non-interactive, and is NOT a chip variant", () => {
    const html = renderToString(<ChipFlag tone="warn">M</ChipFlag>);
    expect(html.startsWith("<span")).toBe(true);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("role=");
    // Its own root class — inheriting the pill's rules would erase the squared machine-fact shape.
    expect(html).not.toContain(`class="my-chip `);
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

describe("the card's “never colour alone” rule is enforced by the TYPE, not by hope", () => {
  // The do/don't panel bans a colour-only chip outright ("a colour-only chip says nothing to a
  // screen reader"), and a flag is an honest counter, never decoration. Both components therefore
  // declare `children` as REQUIRED, so `<Chip tone="error" />` is a compile error rather than a
  // silent, meaningless swatch. A runtime test cannot observe a compile error, so this pins the
  // declaration itself — the thing that would have to be weakened to lose the guarantee.
  test.each(["Chip", "ChipFlag"])("%s declares children without a `?`", (component) => {
    const src = readFileSync(join(import.meta.dir, "src", `${component}.tsx`), "utf8");
    expect(src).toMatch(/\n  children: ComponentChildren;\n/);
    expect(src).not.toContain("children?:");
  });
});

describe("the retired atoms are GONE from the public surface", () => {
  test("the barrel exports no Tag/Flag under any spelling", async () => {
    const barrel = (await import("./src/index.ts")) as Record<string, unknown>;
    for (const name of ["Tag", "Flag", "tagClass", "flagClass", "TAG_PARTS", "FLAG_PARTS"]) {
      expect({ name, present: name in barrel }).toEqual({ name, present: false });
    }
    // …and the family that replaced them IS exported.
    for (const name of ["Chip", "ChipFlag", "ChipDropdown", "chipClass", "chipFlagClass"]) {
      expect({ name, present: name in barrel }).toEqual({ name, present: true });
    }
  });
});
