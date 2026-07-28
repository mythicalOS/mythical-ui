// test/logic/chip.test.ts — class derivation and copy for the chip family (Chip · ChipFlag ·
// ChipDropdown). The tone/size vocabularies are ENUMERATED from the exported constants rather than
// restated here, so adding a tone without a rule for it cannot pass unnoticed.

import { describe, expect, test } from "bun:test";
import {
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  CHIP_DROPDOWN_PARTS,
  CHIP_FLAG_PARTS,
  CHIP_FLAG_TONES,
  CHIP_PARTS,
  CHIP_REMOVE_GLYPH,
  CHIP_REMOVE_LABEL,
  CHIP_SIZES,
  CHIP_TONES,
  chipClass,
  chipCountText,
  chipDropdownActivate,
  chipDropdownClass,
  chipDropdownValueText,
  chipFlagClass,
  chipRemoveLabel,
  type ChipTone,
} from "../../src/logic/chip.ts";

describe("chipClass — tone", () => {
  test("neutral is the DEFAULT and emits no modifier (the base rule already paints it)", () => {
    expect(chipClass()).toBe("my-chip");
    expect(chipClass("neutral")).toBe("my-chip");
  });

  test("every other tone adds exactly one modifier", () => {
    expect(chipClass("accent")).toBe("my-chip my-chip--accent");
    expect(chipClass("ok")).toBe("my-chip my-chip--ok");
    expect(chipClass("warn")).toBe("my-chip my-chip--warn");
    expect(chipClass("error")).toBe("my-chip my-chip--error");
    expect(chipClass("info")).toBe("my-chip my-chip--info");
    expect(chipClass("outline")).toBe("my-chip my-chip--outline");
    expect(chipClass("empty")).toBe("my-chip my-chip--empty");
  });

  test("the card's whole tone set is covered, with nothing extra", () => {
    expect([...CHIP_TONES]).toEqual([
      "neutral",
      "accent",
      "ok",
      "warn",
      "error",
      "info",
      "outline",
      "empty",
    ]);
    for (const tone of CHIP_TONES) expect(chipClass(tone).startsWith("my-chip")).toBe(true);
  });

  test("the v1 six-tone vocabulary still derives exactly what it used to", () => {
    // The pre-v2 `chipClass` lived in tone.ts and took a 6-tone union. Consumers on those tones
    // must be unaffected by the family fold — only the metrics change, never the class strings.
    expect(chipClass("neutral")).toBe("my-chip");
    for (const tone of ["accent", "ok", "warn", "error", "info"] as const) {
      expect(chipClass(tone)).toBe(`my-chip my-chip--${tone}`);
    }
  });

  test("the house word is `error` — the card's `err` shorthand is NOT a tone here", () => {
    expect((CHIP_TONES as readonly string[]).includes("err")).toBe(false);
    expect(chipClass("error")).toContain("my-chip--error");
    expect(chipClass("error")).not.toContain("err ");
  });

  test("an unknown tone degrades to the default instead of emitting a rule-less modifier", () => {
    // Reachable from a JS consumer, or from a product still passing the card's `err` shorthand. A
    // `my-chip--err` class would paint nothing at all, leaving a chip that claims a status it
    // never shows; falling back keeps the label readable and simply un-toned.
    expect(chipClass("err" as ChipTone)).toBe("my-chip");
    expect(chipClass(undefined as unknown as ChipTone)).toBe("my-chip");
    expect(chipClass(null as unknown as ChipTone)).toBe("my-chip");
    expect(chipClass(123 as unknown as ChipTone)).toBe("my-chip");
  });
});

describe("chipClass — size", () => {
  test("omitting size is the default step (no size modifier at all)", () => {
    expect(chipClass("ok")).toBe("my-chip my-chip--ok");
    expect(chipClass("ok", {})).toBe("my-chip my-chip--ok");
    expect(chipClass("ok", { size: undefined })).toBe("my-chip my-chip--ok");
  });

  test("xs and md add their modifier after the tone", () => {
    expect(chipClass("neutral", { size: "xs" })).toBe("my-chip my-chip--xs");
    expect(chipClass("neutral", { size: "md" })).toBe("my-chip my-chip--md");
    expect(chipClass("ok", { size: "xs" })).toBe("my-chip my-chip--ok my-chip--xs");
    expect(chipClass("outline", { size: "md" })).toBe("my-chip my-chip--outline my-chip--md");
  });

  test("only the card's two named steps exist", () => {
    expect([...CHIP_SIZES]).toEqual(["xs", "md"]);
  });

  test("an unknown size degrades to the default step", () => {
    expect(chipClass("ok", { size: "lg" as never })).toBe("my-chip my-chip--ok");
    expect(chipClass("ok", null as never)).toBe("my-chip my-chip--ok");
  });
});

describe("CHIP_PARTS / removal copy", () => {
  test("the parts are the card's element classes", () => {
    expect(CHIP_PARTS).toEqual({
      root: "my-chip",
      dot: "my-chip__dot",
      num: "my-chip__num",
      remove: "my-chip__x",
    });
  });

  test("the removal glyph is the card's ×", () => {
    expect(CHIP_REMOVE_GLYPH).toBe("×");
  });

  test("a named subject gets the card's `Remove <name>`", () => {
    expect(chipRemoveLabel("reviewed")).toBe("Remove reviewed");
    expect(chipRemoveLabel("  needs rebase  ")).toBe("Remove needs rebase");
  });

  test("an unnamed subject is announced as the bare label, never a guessed one", () => {
    expect(chipRemoveLabel()).toBe(CHIP_REMOVE_LABEL);
    expect(chipRemoveLabel("")).toBe(CHIP_REMOVE_LABEL);
    expect(chipRemoveLabel("   ")).toBe(CHIP_REMOVE_LABEL);
    expect(chipRemoveLabel(42 as unknown as string)).toBe(CHIP_REMOVE_LABEL);
  });

  test("the accessible name is never empty — an unlabelled control is unusable by voice", () => {
    for (const name of [undefined, "", "   ", "x"]) {
      expect(chipRemoveLabel(name).length).toBeGreaterThan(0);
    }
  });
});

describe("chipCountText", () => {
  test("a real non-negative integer renders — including 0", () => {
    expect(chipCountText(248)).toBe("248");
    expect(chipCountText(3)).toBe("3");
    // 0 is a genuinely reported count, not an absence: `count && …` would have eaten it.
    expect(chipCountText(0)).toBe("0");
  });

  test("nothing that is not a count renders one", () => {
    // Same contract, and the same reasoning, as git-chip's `isCount`: a fraction cannot be a
    // number of records and a negative cannot be a number of anything, so both are malformed
    // data. Rendering them would claim a measurement the caller never made.
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, -1, 1.5, -0.5, "12", "", {}, []]) {
      expect({ bad, text: chipCountText(bad) }).toEqual({ bad, text: null });
    }
  });

  test("-0 is 0, not a negative", () => {
    expect(chipCountText(-0)).toBe("0");
  });
});

describe("chipFlagClass", () => {
  test("accent is the DEFAULT and emits no modifier", () => {
    expect(chipFlagClass()).toBe("my-chip-flag");
    expect(chipFlagClass("accent")).toBe("my-chip-flag");
  });

  test("every other tone adds exactly one modifier", () => {
    expect(chipFlagClass("ok")).toBe("my-chip-flag my-chip-flag--ok");
    expect(chipFlagClass("warn")).toBe("my-chip-flag my-chip-flag--warn");
    expect(chipFlagClass("error")).toBe("my-chip-flag my-chip-flag--error");
    expect(chipFlagClass("neutral")).toBe("my-chip-flag my-chip-flag--neutral");
  });

  test("the card's flag set is exactly these five — there is no info flag", () => {
    expect([...CHIP_FLAG_TONES]).toEqual(["accent", "ok", "warn", "error", "neutral"]);
    expect((CHIP_FLAG_TONES as readonly string[]).includes("info")).toBe(false);
    expect(CHIP_FLAG_PARTS.root).toBe("my-chip-flag");
  });

  test("a flag's root is its OWN class, never a modifier of the chip", () => {
    // `.my-chip-flag` must not be a `.my-chip` variant: the two shapes are the whole point of the
    // family split (pill vs squared), and one inheriting the other's fill would erase it.
    expect(chipFlagClass()).not.toContain("my-chip ");
    expect(chipFlagClass("ok").split(/\s+/)).not.toContain("my-chip");
  });

  test("an unknown tone degrades to the default", () => {
    expect(chipFlagClass("err" as never)).toBe("my-chip-flag");
    expect(chipFlagClass(undefined as never)).toBe("my-chip-flag");
  });
});

describe("chipDropdownClass", () => {
  test("the base is the bare root", () => {
    expect(chipDropdownClass()).toBe("my-chip-dd");
    expect(chipDropdownClass({})).toBe("my-chip-dd");
    expect(chipDropdownClass({ selected: false })).toBe("my-chip-dd");
  });

  test("selected adds the card's .sel modifier", () => {
    expect(chipDropdownClass({ selected: true })).toBe("my-chip-dd my-chip-dd--sel");
  });

  test("only a real `true` selects — a truthy non-boolean does not claim a selection", () => {
    expect(chipDropdownClass({ selected: 1 as unknown as boolean })).toBe("my-chip-dd");
    expect(chipDropdownClass(null as never)).toBe("my-chip-dd");
  });

  test("disabled is NOT a class — it rides the element's own disabled semantics", () => {
    // Pinned deliberately: a `my-chip-dd--disabled` class could paint the disabled state without
    // announcing it, which is exactly the dishonest half-state this split prevents.
    expect(chipDropdownClass({ selected: true })).not.toContain("disabled");
    expect(JSON.stringify(CHIP_DROPDOWN_PARTS)).not.toContain("disabled");
  });

  test("the parts and the caret glyph are the card's", () => {
    expect(CHIP_DROPDOWN_PARTS).toEqual({
      root: "my-chip-dd",
      value: "my-chip-dd__value",
      caret: "my-chip-dd__caret",
    });
    expect(CHIP_DROPDOWN_CARET).toBe("▾");
  });

  test("the dropdown's root is its OWN class, never a modifier of the chip", () => {
    // Same reason as the flag: shape carries the affordance, so the ONE clickable member must not
    // inherit the pill's rules.
    expect(chipDropdownClass().split(/\s+/)).not.toContain("my-chip");
  });
});

describe("chipDropdownActivate", () => {
  function fakeEvent() {
    const seen = { prevented: 0, stopped: 0 };
    return {
      seen,
      event: {
        preventDefault: () => {
          seen.prevented += 1;
        },
        stopPropagation: () => {
          seen.stopped += 1;
        },
      },
    };
  }

  test("an enabled chip activates and the event is left alone", () => {
    const { event, seen } = fakeEvent();
    expect(chipDropdownActivate(event)).toBe(true);
    expect(chipDropdownActivate(event, {})).toBe(true);
    expect(chipDropdownActivate(event, { disabled: false })).toBe(true);
    expect(seen).toEqual({ prevented: 0, stopped: 0 });
  });

  test("a disabled chip does NOT activate, and the event is SUPPRESSED", () => {
    // The whole point: `aria-disabled` keeps the chip focusable, so the platform still dispatches
    // a click. Declining to handle it is not enough — an unstopped click bubbles, and a disabled
    // chip inside a clickable row would activate the row.
    const { event, seen } = fakeEvent();
    expect(chipDropdownActivate(event, { disabled: true })).toBe(false);
    expect(seen).toEqual({ prevented: 1, stopped: 1 });
  });

  test("only a real `true` disables — a truthy non-boolean does not silently deaden the chip", () => {
    const { event, seen } = fakeEvent();
    expect(chipDropdownActivate(event, { disabled: 1 as unknown as boolean })).toBe(true);
    expect(chipDropdownActivate(event, null as never)).toBe(true);
    expect(seen).toEqual({ prevented: 0, stopped: 0 });
  });

  test("a malformed event cannot crash the disabled path (it still refuses to activate)", () => {
    expect(chipDropdownActivate({} as never, { disabled: true })).toBe(false);
    expect(chipDropdownActivate(null as never, { disabled: true })).toBe(false);
  });
});

describe("chipDropdownValueText", () => {
  test("a real value passes through, trimmed", () => {
    expect(chipDropdownValueText("sonnet-4.6")).toBe("sonnet-4.6");
    expect(chipDropdownValueText("  main  ")).toBe("main");
  });

  test("no value renders the honest em dash, never a blank slot", () => {
    expect(chipDropdownValueText()).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
    expect(chipDropdownValueText("")).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
    expect(chipDropdownValueText("   ")).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
    expect(chipDropdownValueText(undefined)).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
    expect(chipDropdownValueText(null as unknown as string)).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
    expect(chipDropdownValueText(7 as unknown as string)).toBe(CHIP_DROPDOWN_EMPTY_VALUE);
  });
});

describe("the family is retired-name free", () => {
  test("no `tag`/`flag` spelling survives in the emitted classes or the exported copy", () => {
    // The v2 card retires the `Tag` concept outright. A leftover `my-tag*` class would be a
    // selector with no rule behind it — an invisible component, shipped green.
    const emitted = [
      ...CHIP_TONES.flatMap((t) => [chipClass(t), chipClass(t, { size: "xs" }), chipClass(t, { size: "md" })]),
      ...CHIP_FLAG_TONES.map((t) => chipFlagClass(t)),
      chipDropdownClass(),
      chipDropdownClass({ selected: true }),
      ...Object.values(CHIP_PARTS),
      ...Object.values(CHIP_FLAG_PARTS),
      ...Object.values(CHIP_DROPDOWN_PARTS),
    ];
    for (const cls of emitted) {
      expect({ cls, tag: cls.includes("my-tag"), flag: cls.includes("my-flag") }).toEqual({
        cls,
        tag: false,
        flag: false,
      });
    }
  });
});
