// test/logic/save-bar.test.ts — the save bar's pure text composition (ds/layouts-settings.html).
// The card's own sentence is `1 unsaved change · Base URL`; the plural, the separator and the
// dirty predicate are all derived here so the Preact and React bars can never word it differently.

import { describe, expect, test } from "bun:test";
import {
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  SAVE_BAR_SEP,
  saveBarClass,
  saveBarDirty,
  saveBarNote,
} from "../../src/index.ts";

describe("saveBarNote — count, plural and the card's sentence", () => {
  test("one changed field renders the card's exact sentence", () => {
    const note = saveBarNote(["Base URL"]);
    expect(note.count).toBe(1);
    expect(note.countLabel).toBe("1 unsaved change");
    expect(note.detail).toBe("Base URL");
    expect(note.text).toBe(`1 unsaved change${SAVE_BAR_SEP}Base URL`);
  });

  test("two or more changed fields pluralize and join with a comma", () => {
    const note = saveBarNote(["Base URL", "Harness", "Telemetry"]);
    expect(note.count).toBe(3);
    expect(note.countLabel).toBe("3 unsaved changes");
    expect(note.detail).toBe("Base URL, Harness, Telemetry");
    expect(note.text).toBe(`3 unsaved changes${SAVE_BAR_SEP}Base URL, Harness, Telemetry`);
  });

  test("no changed fields ⇒ count 0, plural label, and NO dangling separator", () => {
    const note = saveBarNote([]);
    expect(note.count).toBe(0);
    expect(note.countLabel).toBe("0 unsaved changes");
    expect(note.detail).toBe("");
    expect(note.text).toBe("0 unsaved changes");
    expect(note.text).not.toContain(SAVE_BAR_SEP);
  });

  test("blank / non-string entries are dropped BEFORE the count, so the count matches the list", () => {
    const note = saveBarNote(["Base URL", "", "   ", undefined as unknown as string, "Harness"]);
    expect(note.count).toBe(2);
    expect(note.detail).toBe("Base URL, Harness");
    expect(note.text).not.toContain("undefined");
  });

  test("the separator is the design card's middle dot, not a hyphen", () => {
    expect(SAVE_BAR_SEP).toBe(" · ");
  });

  test("the input array is not mutated", () => {
    const changed = ["Base URL", ""];
    saveBarNote(changed);
    expect(changed).toEqual(["Base URL", ""]);
  });
});

describe("saveBarDirty — the card's 'only when dirty' rule as a predicate", () => {
  test.each([
    [[], false],
    [[""], false],
    [["  "], false],
    [["Base URL"], true],
    [["Base URL", "Harness"], true],
  ] as [string[], boolean][])("%p ⇒ %p", (changed, expected) => {
    expect(saveBarDirty(changed)).toBe(expected);
  });
});

describe("saveBarClass + copy constants", () => {
  test("root class", () => {
    expect(saveBarClass()).toBe("my-savebar");
  });
  test("the default action copy is the design card's", () => {
    expect(SAVE_BAR_DISCARD_LABEL).toBe("Discard");
    expect(SAVE_BAR_SAVE_LABEL).toBe("Save & apply");
  });
});
