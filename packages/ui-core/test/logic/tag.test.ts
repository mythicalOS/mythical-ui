// test/logic/tag.test.ts — class derivation and copy for the tags & chips family (Tag · Flag ·
// ChipDropdown). The tone/size vocabularies are ENUMERATED from the exported constants rather than
// restated here, so adding a tone without a rule for it cannot pass unnoticed.

import { describe, expect, test } from "bun:test";
import {
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  CHIP_DROPDOWN_PARTS,
  FLAG_PARTS,
  FLAG_TONES,
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  TAG_REMOVE_LABEL,
  TAG_SIZES,
  TAG_TONES,
  chipDropdownActivate,
  chipDropdownClass,
  chipDropdownValueText,
  flagClass,
  tagClass,
  tagCountText,
  tagRemoveLabel,
  type TagTone,
} from "../../src/logic/tag.ts";

describe("tagClass — tone", () => {
  test("accent is the DEFAULT and emits no modifier (the base rule already paints it)", () => {
    expect(tagClass()).toBe("my-tag");
    expect(tagClass("accent")).toBe("my-tag");
  });

  test("every other tone adds exactly one modifier", () => {
    expect(tagClass("ok")).toBe("my-tag my-tag--ok");
    expect(tagClass("warn")).toBe("my-tag my-tag--warn");
    expect(tagClass("error")).toBe("my-tag my-tag--error");
    expect(tagClass("info")).toBe("my-tag my-tag--info");
    expect(tagClass("neutral")).toBe("my-tag my-tag--neutral");
    expect(tagClass("outline")).toBe("my-tag my-tag--outline");
    expect(tagClass("empty")).toBe("my-tag my-tag--empty");
  });

  test("the card's whole tone set is covered, with nothing extra", () => {
    expect([...TAG_TONES]).toEqual([
      "accent",
      "ok",
      "warn",
      "error",
      "info",
      "neutral",
      "outline",
      "empty",
    ]);
    for (const tone of TAG_TONES) expect(tagClass(tone).startsWith("my-tag")).toBe(true);
  });

  test("the house word is `error` — the card's `err` shorthand is NOT a tone here", () => {
    expect((TAG_TONES as readonly string[]).includes("err")).toBe(false);
    expect(tagClass("error")).toContain("my-tag--error");
    expect(tagClass("error")).not.toContain("err ");
  });

  test("an unknown tone degrades to the default instead of emitting a rule-less modifier", () => {
    // Reachable from a JS consumer, or from a product still passing the card's `err` shorthand. A
    // `my-tag--err` class would paint nothing at all, leaving a tag that claims a status it never
    // shows; falling back keeps the label readable and simply un-toned.
    expect(tagClass("err" as TagTone)).toBe("my-tag");
    expect(tagClass(undefined as unknown as TagTone)).toBe("my-tag");
    expect(tagClass(null as unknown as TagTone)).toBe("my-tag");
    expect(tagClass(123 as unknown as TagTone)).toBe("my-tag");
  });
});

describe("tagClass — size", () => {
  test("omitting size is the default step (no size modifier at all)", () => {
    expect(tagClass("ok")).toBe("my-tag my-tag--ok");
    expect(tagClass("ok", {})).toBe("my-tag my-tag--ok");
    expect(tagClass("ok", { size: undefined })).toBe("my-tag my-tag--ok");
  });

  test("xs and md add their modifier after the tone", () => {
    expect(tagClass("accent", { size: "xs" })).toBe("my-tag my-tag--xs");
    expect(tagClass("accent", { size: "md" })).toBe("my-tag my-tag--md");
    expect(tagClass("ok", { size: "xs" })).toBe("my-tag my-tag--ok my-tag--xs");
    expect(tagClass("outline", { size: "md" })).toBe("my-tag my-tag--outline my-tag--md");
  });

  test("only the card's two named steps exist", () => {
    expect([...TAG_SIZES]).toEqual(["xs", "md"]);
  });

  test("an unknown size degrades to the default step", () => {
    expect(tagClass("ok", { size: "lg" as never })).toBe("my-tag my-tag--ok");
    expect(tagClass("ok", null as never)).toBe("my-tag my-tag--ok");
  });
});

describe("TAG_PARTS / removal copy", () => {
  test("the parts are the card's element classes", () => {
    expect(TAG_PARTS).toEqual({
      root: "my-tag",
      dot: "my-tag__dot",
      num: "my-tag__num",
      remove: "my-tag__x",
    });
  });

  test("the removal glyph is the card's ×", () => {
    expect(TAG_REMOVE_GLYPH).toBe("×");
  });

  test("a named subject gets the card's `Remove <name>`", () => {
    expect(tagRemoveLabel("reviewed")).toBe("Remove reviewed");
    expect(tagRemoveLabel("  needs rebase  ")).toBe("Remove needs rebase");
  });

  test("an unnamed subject is announced as the bare label, never a guessed one", () => {
    expect(tagRemoveLabel()).toBe(TAG_REMOVE_LABEL);
    expect(tagRemoveLabel("")).toBe(TAG_REMOVE_LABEL);
    expect(tagRemoveLabel("   ")).toBe(TAG_REMOVE_LABEL);
    expect(tagRemoveLabel(42 as unknown as string)).toBe(TAG_REMOVE_LABEL);
  });

  test("the accessible name is never empty — an unlabelled control is unusable by voice", () => {
    for (const name of [undefined, "", "   ", "x"]) expect(tagRemoveLabel(name).length).toBeGreaterThan(0);
  });
});

describe("tagCountText", () => {
  test("a real non-negative integer renders — including 0", () => {
    expect(tagCountText(248)).toBe("248");
    expect(tagCountText(3)).toBe("3");
    // 0 is a genuinely reported count, not an absence: `count && …` would have eaten it.
    expect(tagCountText(0)).toBe("0");
  });

  test("nothing that is not a count renders one", () => {
    // Same contract, and the same reasoning, as git-chip's `isCount`: a fraction cannot be a
    // number of records and a negative cannot be a number of anything, so both are malformed
    // data. Rendering them would claim a measurement the caller never made.
    for (const bad of [undefined, null, NaN, Infinity, -Infinity, -1, 1.5, -0.5, "12", "", {}, []]) {
      expect({ bad, text: tagCountText(bad) }).toEqual({ bad, text: null });
    }
  });

  test("-0 is 0, not a negative", () => {
    expect(tagCountText(-0)).toBe("0");
  });
});

describe("flagClass", () => {
  test("accent is the DEFAULT and emits no modifier", () => {
    expect(flagClass()).toBe("my-flag");
    expect(flagClass("accent")).toBe("my-flag");
  });

  test("every other tone adds exactly one modifier", () => {
    expect(flagClass("ok")).toBe("my-flag my-flag--ok");
    expect(flagClass("warn")).toBe("my-flag my-flag--warn");
    expect(flagClass("error")).toBe("my-flag my-flag--error");
    expect(flagClass("neutral")).toBe("my-flag my-flag--neutral");
  });

  test("the card's flag set is exactly these five — there is no info flag", () => {
    expect([...FLAG_TONES]).toEqual(["accent", "ok", "warn", "error", "neutral"]);
    expect((FLAG_TONES as readonly string[]).includes("info")).toBe(false);
    expect(FLAG_PARTS.root).toBe("my-flag");
  });

  test("an unknown tone degrades to the default", () => {
    expect(flagClass("err" as never)).toBe("my-flag");
    expect(flagClass(undefined as never)).toBe("my-flag");
  });
});

describe("chipDropdownClass", () => {
  test("the base is the bare root", () => {
    expect(chipDropdownClass()).toBe("my-chipdd");
    expect(chipDropdownClass({})).toBe("my-chipdd");
    expect(chipDropdownClass({ selected: false })).toBe("my-chipdd");
  });

  test("selected adds the card's .sel modifier", () => {
    expect(chipDropdownClass({ selected: true })).toBe("my-chipdd my-chipdd--sel");
  });

  test("only a real `true` selects — a truthy non-boolean does not claim a selection", () => {
    expect(chipDropdownClass({ selected: 1 as unknown as boolean })).toBe("my-chipdd");
    expect(chipDropdownClass(null as never)).toBe("my-chipdd");
  });

  test("disabled is NOT a class — it rides the element's own disabled semantics", () => {
    // Pinned deliberately: a `my-chipdd--disabled` class could paint the disabled state without
    // announcing it, which is exactly the dishonest half-state this split prevents.
    expect(chipDropdownClass({ selected: true })).not.toContain("disabled");
    expect(JSON.stringify(CHIP_DROPDOWN_PARTS)).not.toContain("disabled");
  });

  test("the parts and the caret glyph are the card's", () => {
    expect(CHIP_DROPDOWN_PARTS).toEqual({
      root: "my-chipdd",
      value: "my-chipdd__value",
      caret: "my-chipdd__caret",
    });
    expect(CHIP_DROPDOWN_CARET).toBe("▾");
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
