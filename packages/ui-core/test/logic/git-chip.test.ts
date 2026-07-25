// test/logic/git-chip.test.ts — the git status chip's flag derivation, branch label, copy and
// class derivation (ds/components-git-chip.html).
//
// The honesty contract is what this file exists to pin:
//   - `null` behind/unpushed = NO UPSTREAM ⇒ the flag is OMITTED, never rendered "0 behind",
//   - a `null` branch is a detached HEAD, never a blank,
//   - a status whose counters were never reported is NEVER collapsed into a green "clean ✓",
//   - the unavailable copy never describes the tree.

import { describe, expect, test } from "bun:test";
import {
  GIT_BRANCH_GLYPH,
  GIT_BRANCH_UNKNOWN,
  GIT_CLEAN_LABEL,
  GIT_DETACHED_LABEL,
  GIT_LOADING_NOTE,
  GIT_STALE_LABEL,
  GIT_UNAVAILABLE_NOTE,
  gitBranchLabel,
  gitChipClass,
  gitChipNote,
  gitFlagClass,
  gitFlags,
  type GitFlagTone,
  type GitStatus,
} from "../../src/index.ts";

/** A fully reported, all-clear tree with an upstream. */
const clean: GitStatus = { branch: "main", behind: 0, uncommitted: 0, unpushed: 0 };

describe("gitFlags — the design card's dirty row", () => {
  test("the card's dirty chip: behind · uncommitted · unpushed, in that order, with its tones", () => {
    const flags = gitFlags({
      branch: "feat/control-room-daemon-gaps",
      behind: 2,
      uncommitted: 4,
      unpushed: 1,
    });
    expect(flags).toEqual([
      { label: "2↓ behind", tone: "warn" },
      { label: "4 uncommitted", tone: "warn" },
      { label: "1 unpushed", tone: "error" },
    ]);
  });

  test("the card's clean chip collapses to a single ok flag", () => {
    expect(gitFlags(clean)).toEqual([{ label: GIT_CLEAN_LABEL, tone: "ok" }]);
    expect(GIT_CLEAN_LABEL).toContain("✓"); // token rule #7 — a glyph rides with the color
  });

  test("only the non-zero counters appear", () => {
    expect(gitFlags({ ...clean, uncommitted: 3 })).toEqual([
      { label: "3 uncommitted", tone: "warn" },
    ]);
  });
});

describe("gitFlags — honesty: null means NO UPSTREAM, never a zero", () => {
  test("null behind/unpushed omit their flags entirely", () => {
    const flags = gitFlags({ branch: "main", behind: null, uncommitted: 2, unpushed: null });
    expect(flags).toEqual([{ label: "2 uncommitted", tone: "warn" }]);
    expect(JSON.stringify(flags)).not.toContain("behind");
    expect(JSON.stringify(flags)).not.toContain("unpushed");
  });

  test("no upstream + a clean worktree is still an honest 'clean ✓' (null IS a reported answer)", () => {
    expect(gitFlags({ branch: "main", behind: null, uncommitted: 0, unpushed: null })).toEqual([
      { label: GIT_CLEAN_LABEL, tone: "ok" },
    ]);
  });
});

describe("gitFlags — honesty: an UNREPORTED status is never coerced into 'clean'", () => {
  test("a status with no counters at all yields NO flags (not a green clean row)", () => {
    const flags = gitFlags({ branch: "main" } as unknown as GitStatus);
    expect(flags).toEqual([]);
  });

  test.each([
    ["uncommitted unreported", { branch: "main", behind: 0, unpushed: 0 }],
    ["behind unreported", { branch: "main", uncommitted: 0, unpushed: 0 }],
    ["unpushed unreported", { branch: "main", behind: 0, uncommitted: 0 }],
  ] as [string, Record<string, unknown>][])("%s ⇒ no clean claim", (_name, partial) => {
    const flags = gitFlags(partial as unknown as GitStatus);
    expect(flags.some((f) => f.label === GIT_CLEAN_LABEL)).toBe(false);
  });

  test("garbage counters (NaN / negative) neither render a flag nor earn a clean claim", () => {
    const flags = gitFlags({
      branch: "main",
      behind: Number.NaN,
      uncommitted: -1,
      unpushed: Number.NaN,
    });
    expect(flags).toEqual([]);
  });

  test("an entirely missing status object degrades to no flags rather than throwing", () => {
    expect(gitFlags(undefined as unknown as GitStatus)).toEqual([]);
  });
});

describe("gitBranchLabel", () => {
  test("a real branch name passes through", () => {
    expect(gitBranchLabel("feat/control-room-daemon-gaps")).toBe("feat/control-room-daemon-gaps");
  });
  test("null is a detached HEAD, never a blank", () => {
    expect(gitBranchLabel(null)).toBe(GIT_DETACHED_LABEL);
    expect(GIT_DETACHED_LABEL).toBe("detached HEAD");
  });
  test("an empty name is treated as detached rather than rendered blank", () => {
    expect(gitBranchLabel("")).toBe(GIT_DETACHED_LABEL);
  });
  test("an UNREPORTED branch is the neutral dash — it does not claim a detached checkout", () => {
    expect(gitBranchLabel(undefined)).toBe(GIT_BRANCH_UNKNOWN);
    expect(GIT_BRANCH_UNKNOWN).not.toBe(GIT_DETACHED_LABEL);
  });
  test("the card's branch glyph", () => {
    expect(GIT_BRANCH_GLYPH).toBe("⎇");
  });
});

describe("gitChipNote — the unavailable arm never describes the tree", () => {
  test("a caller-supplied reason wins", () => {
    expect(gitChipNote({ unavailableNote: "No worktree is recorded." })).toBe(
      "No worktree is recorded.",
    );
  });
  test("a blank reason falls through to the defaults rather than rendering empty", () => {
    expect(gitChipNote({ unavailableNote: "   " })).toBe(GIT_UNAVAILABLE_NOTE);
    expect(gitChipNote({ unavailableNote: "   ", loading: true })).toBe(GIT_LOADING_NOTE);
  });
  test("loading, with no reason, is the in-flight line", () => {
    expect(gitChipNote({ loading: true })).toBe(GIT_LOADING_NOTE);
  });
  test("neither ⇒ the neutral default, with no call taken and no args at all", () => {
    expect(gitChipNote({})).toBe(GIT_UNAVAILABLE_NOTE);
    expect(gitChipNote()).toBe(GIT_UNAVAILABLE_NOTE);
  });
  test("no default copy claims the tree is clean or dirty", () => {
    for (const copy of [GIT_UNAVAILABLE_NOTE, GIT_LOADING_NOTE]) {
      expect(copy.toLowerCase()).not.toContain("clean");
      expect(copy.toLowerCase()).not.toContain("uncommitted");
    }
  });
});

describe("class derivation", () => {
  test("base", () => {
    expect(gitChipClass()).toBe("my-gitchip");
    expect(gitChipClass({})).toBe("my-gitchip");
  });
  test("unavailable / stale modifiers, and both together", () => {
    expect(gitChipClass({ unavailable: true })).toBe("my-gitchip my-gitchip--unavailable");
    expect(gitChipClass({ stale: true })).toBe("my-gitchip my-gitchip--stale");
    expect(gitChipClass({ unavailable: true, stale: true })).toBe(
      "my-gitchip my-gitchip--unavailable my-gitchip--stale",
    );
  });
  test.each(["warn", "error", "ok"] as GitFlagTone[])("gitFlagClass(%s)", (tone) => {
    expect(gitFlagClass(tone)).toBe(`my-gitchip__flag my-gitchip__flag--${tone}`);
  });
  test("the stale marker copy", () => {
    expect(GIT_STALE_LABEL).toBe("· stale");
  });
});
