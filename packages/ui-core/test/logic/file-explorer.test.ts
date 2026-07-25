// test/logic/file-explorer.test.ts — the file-explorer derivations (ds/components-file-explorer).
//
// The card's substance, pinned:
//   · the TWO tree modes are genuinely different trees (all-mounts vs project), not two skins;
//   · git marks, badges, chevrons, breadcrumbs and the size/mtime header derive from here;
//   · the FOUR honest states (unavailable · empty · too-large · binary) each survive every code
//     path, are distinctly renderable, and are never styled as a failure;
//   · every class string this module emits has a real selector in styles.css.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HONEST_STATUSES,
  MAX_INDENT_DEPTH,
  ancestorRelPaths,
  badgeClass,
  breadcrumbSegments,
  buildBreadcrumb,
  chevronGlyph,
  childRelPath,
  classifyDirNode,
  countLoadedFiles,
  deriveFileTreeRows,
  dirRowClass,
  fileGlyph,
  fileRowClass,
  formatFileSize,
  formatRelativeTime,
  gitMarkClass,
  gitMarkLabel,
  gitMarkTone,
  honestNoteClass,
  honestNoteText,
  indentClass,
  isHonestStatus,
  isMarkdownName,
  nodeId,
  parentRelPath,
  previewBadge,
  previewBadgeClass,
  previewBodyMode,
  previewMeta,
  previewNoteClass,
  previewNoteText,
  repoBadges,
  scopeGlyph,
  scopeItemClass,
  splitNodeId,
  treeNoteRowClass,
  type DirState,
  type FilePreviewState,
  type FileTreeEntry,
  type FileTreeRootSpec,
  type GitMark,
  type HonestStatus,
} from "../../src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "..", "styles.css"), "utf8");

function hasSelector(className: string): boolean {
  return new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(css);
}
function expectSelectors(classString: string) {
  for (const token of classString.split(/\s+/).filter(Boolean)) {
    expect({ token, present: hasSelector(token) }).toEqual({ token, present: true });
  }
}

const loaded = (entries: readonly FileTreeEntry[], truncated = false): DirState => ({
  status: "loaded",
  entries,
  truncated,
});

// ── the two tree modes ────────────────────────────────────────────────────────

describe("the two tree modes are different trees, not two skins", () => {
  test("all-mounts: roots are MOUNTS, and the level beneath them is where repos live", () => {
    expect(classifyDirNode("all-mounts", 0)).toBe("mount");
    expect(classifyDirNode("all-mounts", 1)).toBe("repo");
    expect(classifyDirNode("all-mounts", 2)).toBe("dir");
    expect(classifyDirNode("all-mounts", 5)).toBe("dir");
  });

  test("project: the project's REPOS ARE THE ROOTS; everything deeper is a plain directory", () => {
    expect(classifyDirNode("project", 0)).toBe("repo");
    expect(classifyDirNode("project", 1)).toBe("dir");
    expect(classifyDirNode("project", 4)).toBe("dir");
  });

  test("the SAME depth classifies differently per mode — the modes are not interchangeable", () => {
    expect(classifyDirNode("all-mounts", 0)).not.toBe(classifyDirNode("project", 0));
    expect(classifyDirNode("all-mounts", 1)).not.toBe(classifyDirNode("project", 1));
  });

  test("a caller that KNOWS a depth-1 directory is not a repo overrides the structural rule", () => {
    expect(classifyDirNode("all-mounts", 1, false)).toBe("dir");
    expect(classifyDirNode("all-mounts", 1, true)).toBe("repo");
    // and a deep directory that IS a repo can say so
    expect(classifyDirNode("all-mounts", 3, true)).toBe("repo");
  });

  test("all-mounts renders mount roots mono/muted (⌂) with repos accent-strong (⎇) one level down", () => {
    const rootKey = "work";
    const rows = deriveFileTreeRows({
      mode: "all-mounts",
      roots: [{ key: rootKey, label: "/work" }],
      dirs: { [nodeId(rootKey, "")]: loaded([{ name: "core", kind: "dir" }]) },
      expanded: new Set([nodeId(rootKey, "")]),
    });
    const mount = rows[0];
    const repo = rows[1];
    expect(mount).toMatchObject({ type: "dir", kind: "mount", glyph: "⌂", name: "/work", depth: 0 });
    expect(repo).toMatchObject({ type: "dir", kind: "repo", glyph: "⎇", name: "core", depth: 1 });
    expect(mount!.className).toContain("my-files__row--mount");
    expect(repo!.className).toContain("my-files__row--repo");
  });

  test("project mode: repos ARE the roots, carrying primary / shared-project badges", () => {
    const roots: FileTreeRootSpec[] = [
      { key: "core", label: "core", primary: true },
      { key: "docs", label: "docs-site", projectCount: 2 },
      { key: "h", label: "harness" },
    ];
    const rows = deriveFileTreeRows({ mode: "project", roots, dirs: {}, expanded: new Set() });
    expect(rows[0]).toMatchObject({ kind: "repo", glyph: "⎇", depth: 0 });
    expect((rows[0] as { badges: unknown }).badges).toEqual([{ text: "primary", tone: "accent" }]);
    expect((rows[1] as { badges: unknown }).badges).toEqual([{ text: "2 projects", tone: "muted" }]);
    expect((rows[2] as { badges: unknown }).badges).toEqual([]);
  });

  test("badges are PROJECT-mode only — a bind mount has no project membership to report", () => {
    const root: FileTreeRootSpec = { key: "work", label: "/work", primary: true, projectCount: 3 };
    expect(repoBadges(root, "project")).toEqual([
      { text: "primary", tone: "accent" },
      { text: "3 projects", tone: "muted" },
    ]);
    expect(repoBadges(root, "all-mounts")).toEqual([]);
  });

  test("a shared count is only reported when it is actually shared (> 1)", () => {
    expect(repoBadges({ key: "a", label: "a", projectCount: 1 }, "project")).toEqual([]);
    expect(repoBadges({ key: "a", label: "a", projectCount: 0 }, "project")).toEqual([]);
    expect(repoBadges({ key: "a", label: "a", projectCount: Number.NaN }, "project")).toEqual([]);
  });

  test("badges belong to a ROOT repo — a nested directory never carries them", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core", primary: true }],
      dirs: { [nodeId("core", "")]: loaded([{ name: "src", kind: "dir" }]) },
      expanded: new Set([nodeId("core", "")]),
    });
    expect((rows[0] as { badges: unknown[] }).badges).toHaveLength(1);
    expect((rows[1] as { badges: unknown[] }).badges).toHaveLength(0);
  });
});

// ── the four honest states ────────────────────────────────────────────────────

describe("the four honest states are first-class, not errors", () => {
  test("all four are enumerable and recognized", () => {
    expect(HONEST_STATUSES).toEqual(["unavailable", "empty", "too-large", "binary"]);
    for (const s of HONEST_STATUSES) expect(isHonestStatus(s)).toBe(true);
    expect(isHonestStatus("error")).toBe(false);
    expect(isHonestStatus("boom")).toBe(false);
  });

  test("each of the four gets its OWN distinct class — none collides", () => {
    const classes = HONEST_STATUSES.map((s) => honestNoteClass(s));
    expect(new Set(classes).size).toBe(4);
    for (const c of classes) expectSelectors(c);
  });

  test("NONE of the four is styled as a failure (no error/warn/danger modifier)", () => {
    for (const s of HONEST_STATUSES) {
      const c = honestNoteClass(s);
      expect(c).not.toContain("error");
      expect(c).not.toContain("warn");
      expect(c).not.toContain("danger");
      expect(c).not.toContain("fail");
    }
  });

  // one test per honest state, on the surface where it actually appears
  test("honest state 1/4 — UNAVAILABLE: a directory that could not be read says so, and is not empty", () => {
    const id = nodeId("work", "");
    const rows = deriveFileTreeRows({
      mode: "all-mounts",
      roots: [{ key: "work", label: "/work" }],
      dirs: { [id]: { status: "unavailable" } },
      expanded: new Set([id]),
    });
    const note = rows[1] as { type: string; status: string; text: string; className: string };
    expect(note.type).toBe("note");
    expect(note.status).toBe("unavailable");
    expect(note.text).toBe("This directory isn't available right now.");
    expect(note.className).toContain("my-files__note--unavailable");
    // crucially: NOT the empty claim
    expect(note.status).not.toBe("empty");
    // and the preview surface phrases it for a file
    expect(previewNoteText({ status: "unavailable" })).toBe("This file isn't available right now.");
    expect(previewNoteClass({ status: "unavailable" })).toBe(honestNoteClass("unavailable"));
  });

  test("honest state 2/4 — EMPTY: a proven-empty directory is distinct from an unread one", () => {
    const id = nodeId("work", "");
    const rows = deriveFileTreeRows({
      mode: "all-mounts",
      roots: [{ key: "work", label: "/work" }],
      dirs: { [id]: loaded([]) },
      expanded: new Set([id]),
    });
    const note = rows[1] as { status: string; text: string; className: string };
    expect(note.status).toBe("empty");
    expect(note.text).toBe("This directory is empty.");
    expect(note.className).toContain("my-files__note--empty");
    expect(previewNoteText({ status: "empty" })).toBe("This file is empty.");
  });

  test("honest state 3/4 — TOO-LARGE: reports the size and does not pretend to be an error", () => {
    const state: FilePreviewState = { status: "too-large", bytes: 14_500_000 };
    expect(previewNoteText(state)).toBe("This file is too large to display here (13.8 MB).");
    expect(previewNoteClass(state)).toBe(honestNoteClass("too-large"));
    expect(previewBodyMode("x.md", state)).toBe("note");
    // size unknown ⇒ still a complete sentence, never "(undefined)"
    expect(previewNoteText({ status: "too-large" })).toBe("This file is too large to display here.");
  });

  test("honest state 4/4 — BINARY: reports the size and that there is no text preview", () => {
    const state: FilePreviewState = { status: "binary", bytes: 2048 };
    expect(previewNoteText(state)).toBe("This is a binary file (2.0 KB) — no text preview.");
    expect(previewNoteClass(state)).toBe(honestNoteClass("binary"));
    expect(previewBodyMode("logo.png", state)).toBe("note");
    expect(previewNoteText({ status: "binary" })).toBe("This is a binary file — no text preview.");
  });

  test("only the `text` branch renders content; every other branch yields a note", () => {
    const states: FilePreviewState[] = [
      { status: "loading" },
      { status: "unavailable" },
      { status: "empty" },
      { status: "too-large", bytes: 1 },
      { status: "binary", bytes: 1 },
    ];
    for (const s of states) {
      expect(previewNoteText(s)).not.toBeNull();
      expect(previewNoteClass(s)).not.toBeNull();
      expect(previewBodyMode("a.md", s)).toBe("note");
    }
    const text: FilePreviewState = { status: "text", text: "hi" };
    expect(previewNoteText(text)).toBeNull();
    expect(previewNoteClass(text)).toBeNull();
    expect(previewBodyMode("a.md", text)).toBe("markdown");
    expect(previewBodyMode("a.txt", text)).toBe("plain");
  });

  test("an honest-state sentence never leaks a raw `undefined` for an unknown size", () => {
    for (const s of HONEST_STATUSES) {
      expect(honestNoteText(s, "file", undefined)).not.toContain("undefined");
      expect(honestNoteText(s, "dir", undefined)).not.toContain("undefined");
    }
  });
});

// ── tree derivation ───────────────────────────────────────────────────────────

describe("deriveFileTreeRows", () => {
  test("a closed node contributes only its own row", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: { [nodeId("core", "")]: loaded([{ name: "a.md", kind: "file" }]) },
      expanded: new Set(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "dir", open: false, chevron: "▸" });
  });

  test("an expanded node with NO cache entry reads as loading, never as empty", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: {},
      expanded: new Set([nodeId("core", "")]),
    });
    expect(rows[0]).toMatchObject({ open: true, chevron: "▾" });
    expect(rows[1]).toMatchObject({ type: "note", status: "loading", text: "Loading…" });
  });

  test("files carry the card's mono type glyph and their selection state", () => {
    const rootId = nodeId("core", "");
    const selId = nodeId("core", "delivery-envelope.md");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: {
        [rootId]: loaded([
          { name: "delivery-envelope.md", kind: "file" },
          { name: "mount-manifest.json", kind: "file" },
          { name: "run.sh", kind: "file" },
        ]),
      },
      expanded: new Set([rootId]),
      selectedId: selId,
    });
    expect(rows[1]).toMatchObject({ type: "file", glyph: "#", selected: true });
    expect(rows[2]).toMatchObject({ type: "file", glyph: "{}", selected: false });
    expect(rows[3]).toMatchObject({ type: "file", glyph: "·", selected: false });
    expect((rows[1] as { className: string }).className).toContain("my-files__row--sel");
    expect((rows[2] as { className: string }).className).not.toContain("my-files__row--sel");
  });

  test("a mark renders ONLY where the caller supplied one — absence is never a fabricated clean", () => {
    const rootId = nodeId("core", "");
    const marks: Record<string, GitMark> = { [nodeId("core", "a.md")]: "M" };
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: { [rootId]: loaded([{ name: "a.md", kind: "file" }, { name: "b.md", kind: "file" }]) },
      expanded: new Set([rootId]),
      marks,
    });
    expect(rows[1]).toMatchObject({ mark: "M" });
    expect(rows[2]).toMatchObject({ mark: null });
  });

  test("a file named like a prototype member cannot read a mark off Object.prototype", () => {
    const rootId = nodeId("core", "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: { [rootId]: loaded([{ name: "constructor", kind: "file" }, { name: "__proto__", kind: "file" }]) },
      expanded: new Set([rootId]),
      marks: {},
    });
    expect(rows[1]).toMatchObject({ mark: null });
    expect(rows[2]).toMatchObject({ mark: null });
  });

  test("a truncated listing says so, after its entries", () => {
    const rootId = nodeId("core", "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: { [rootId]: loaded([{ name: "a.md", kind: "file" }], true) },
      expanded: new Set([rootId]),
    });
    const last = rows[rows.length - 1] as { type: string; status: string; text: string };
    expect(last.type).toBe("note");
    expect(last.status).toBe("truncated");
    expect(last.text).toContain("some entries are hidden");
  });

  test("nested directories recurse depth-first with growing indent", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: {
        [nodeId("core", "")]: loaded([{ name: "docs", kind: "dir" }]),
        [nodeId("core", "docs")]: loaded([{ name: "api", kind: "dir" }]),
        [nodeId("core", "docs/api")]: loaded([{ name: "x.md", kind: "file" }]),
      },
      expanded: new Set([nodeId("core", ""), nodeId("core", "docs"), nodeId("core", "docs/api")]),
    });
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 2, 3]);
    expect(rows[3]).toMatchObject({ type: "file", name: "x.md", relPath: "docs/api/x.md" });
  });

  test("every row id is unique, so a keyed render can never collide", () => {
    const rows = deriveFileTreeRows({
      mode: "all-mounts",
      roots: [{ key: "work", label: "/work" }, { key: "wt", label: "/worktrees" }],
      dirs: {
        [nodeId("work", "")]: loaded([{ name: "a", kind: "dir" }]),
        [nodeId("work", "a")]: { status: "unavailable" },
        [nodeId("wt", "")]: loaded([]),
      },
      expanded: new Set([nodeId("work", ""), nodeId("work", "a"), nodeId("wt", "")]),
    });
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("countLoadedFiles counts only what has actually been listed", () => {
    expect(
      countLoadedFiles({
        [nodeId("a", "")]: loaded([{ name: "x.md", kind: "file" }, { name: "d", kind: "dir" }]),
        [nodeId("a", "d")]: loaded([{ name: "y.md", kind: "file" }]),
        [nodeId("b", "")]: { status: "loading" },
        [nodeId("c", "")]: { status: "unavailable" },
      }),
    ).toBe(2);
    expect(countLoadedFiles({})).toBe(0);
  });
});

// ── paths, breadcrumbs, glyphs, formatting ────────────────────────────────────

describe("path + breadcrumb composition", () => {
  test("nodeId / splitNodeId round-trip, including paths containing spaces", () => {
    for (const [root, rel] of [["work", ""], ["work", "a/b.md"], ["my repo", "dir with space/x.md"]] as const) {
      expect(splitNodeId(nodeId(root, rel))).toEqual({ rootKey: root, relPath: rel });
    }
  });

  test("a string that is not a node id yields null, never a half-parsed pair", () => {
    expect(splitNodeId("work/a.md")).toBeNull();
    expect(splitNodeId("")).toBeNull();
  });

  test("childRelPath / parentRelPath / ancestorRelPaths", () => {
    expect(childRelPath("", "a")).toBe("a");
    expect(childRelPath("a/b", "c")).toBe("a/b/c");
    expect(parentRelPath("a/b/c")).toEqual({ parentRel: "a/b", name: "c" });
    expect(parentRelPath("c")).toEqual({ parentRel: "", name: "c" });
    expect(ancestorRelPaths("docs/api/x.md")).toEqual(["", "docs", "docs/api"]);
    expect(ancestorRelPaths("x.md")).toEqual([""]);
  });

  test("the breadcrumb ALWAYS includes the root", () => {
    expect(breadcrumbSegments("/work", "core/docs/architecture/delivery-envelope.md")).toEqual([
      "/work",
      "core",
      "docs",
      "architecture",
      "delivery-envelope.md",
    ]);
    expect(buildBreadcrumb("/work", "core/x.md")).toBe("/work  ›  core  ›  x.md");
    // a file at the root still names the root
    expect(buildBreadcrumb("/work", "x.md")).toBe("/work  ›  x.md");
    expect(buildBreadcrumb("/work", "")).toBe("/work");
  });

  test("glyph vocabulary", () => {
    expect(fileGlyph("a.md")).toBe("#");
    expect(fileGlyph("A.MARKDOWN")).toBe("#");
    expect(fileGlyph("a.json")).toBe("{}");
    expect(fileGlyph("a.txt")).toBe("·");
    expect(isMarkdownName("README.MD")).toBe(true);
    expect(isMarkdownName("a.mdx")).toBe(false);
    expect(chevronGlyph(true)).toBe("▾");
    expect(chevronGlyph(false)).toBe("▸");
    expect(scopeGlyph("all-mounts")).toBe("⌂");
    expect(scopeGlyph("project")).toBe("◈");
  });
});

describe("git marks", () => {
  test("the card's legend holds: M → warn, A → ok", () => {
    expect(gitMarkTone("M")).toBe("warn");
    expect(gitMarkTone("A")).toBe("ok");
  });

  test("a rename takes the conservative warn — never a false all-good green", () => {
    expect(gitMarkTone("R")).toBe("warn");
  });

  test("deleted / untracked are muted, and no mark is ever an error tone", () => {
    const marks: GitMark[] = ["M", "A", "D", "R", "?"];
    for (const m of marks) {
      expect(["warn", "ok", "muted"]).toContain(gitMarkTone(m));
      expect(gitMarkLabel(m).length).toBeGreaterThan(0);
      expectSelectors(gitMarkClass(m));
    }
    expect(gitMarkTone("D")).toBe("muted");
    expect(gitMarkTone("?")).toBe("muted");
  });

  test("every mark has a human accessible name — a bare glyph is opaque to AT", () => {
    expect(gitMarkLabel("M")).toBe("modified");
    expect(gitMarkLabel("A")).toBe("added");
    expect(gitMarkLabel("D")).toBe("deleted");
    expect(gitMarkLabel("R")).toBe("renamed");
    expect(gitMarkLabel("?")).toBe("untracked");
  });

  test("the preview pill: a proven clean says 'unchanged'; no git knowledge renders NO pill", () => {
    expect(previewBadge({ kind: "mark", mark: "M" })).toEqual({ text: "modified", tone: "warn" });
    expect(previewBadge({ kind: "mark", mark: "A" })).toEqual({ text: "added", tone: "ok" });
    expect(previewBadge({ kind: "clean" })).toEqual({ text: "unchanged", tone: "muted" });
    expect(previewBadge(null)).toBeNull();
  });
});

describe("the size / mtime header", () => {
  test("formatFileSize", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(14_540)).toBe("14.2 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });

  test("formatFileSize never renders NaN for junk input", () => {
    expect(formatFileSize(-1)).toBe("0 B");
    expect(formatFileSize(Number.NaN)).toBe("0 B");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("0 B");
    expect(formatFileSize(undefined)).toBe("0 B");
  });

  test("formatRelativeTime is pure given an injected now, and never renders a negative age", () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 5 * 86_400_000, now)).toBe("5d ago");
    expect(formatRelativeTime(now + 60_000, now)).toBe("0s ago"); // clock skew clamps
    expect(formatRelativeTime(null, now)).toBe("—");
  });

  test("previewMeta prefers the READ's own values so the header can't show a stale size", () => {
    expect(previewMeta({ status: "text", text: "x", bytes: 10, mtime: 5 }, { bytes: 99, mtime: 99 })).toEqual({
      bytes: 10,
      mtime: 5,
    });
  });

  test("too-large / binary carry a size but no mtime — the listing's mtime fills in", () => {
    expect(previewMeta({ status: "too-large", bytes: 10 }, { bytes: 99, mtime: 42 })).toEqual({ bytes: 10, mtime: 42 });
    expect(previewMeta({ status: "binary", bytes: 10 }, { bytes: 99, mtime: 42 })).toEqual({ bytes: 10, mtime: 42 });
  });

  test("a genuinely unknown value stays undefined rather than becoming a misleading zero", () => {
    expect(previewMeta({ status: "unavailable" }, {})).toEqual({ bytes: undefined, mtime: undefined });
    expect(previewMeta({ status: "text", text: "x" }, {})).toEqual({ bytes: undefined, mtime: undefined });
  });
});

// ── class strings ─────────────────────────────────────────────────────────────

describe("every class string this module emits has a real selector in styles.css", () => {
  test("indent classes are capped and all exist", () => {
    expect(indentClass(0)).toBe("my-files__d0");
    expect(indentClass(MAX_INDENT_DEPTH + 7)).toBe(`my-files__d${MAX_INDENT_DEPTH}`);
    expect(indentClass(-3)).toBe("my-files__d0");
    expect(indentClass(Number.NaN)).toBe("my-files__d0");
    for (let d = 0; d <= MAX_INDENT_DEPTH; d++) expectSelectors(indentClass(d));
  });

  test("row / badge / note / pill / scope classes", () => {
    for (const kind of ["mount", "repo", "dir"] as const) {
      expectSelectors(dirRowClass(kind, 0));
      expectSelectors(dirRowClass(kind, 3, true));
    }
    expectSelectors(fileRowClass(1, false));
    expectSelectors(fileRowClass(1, true));
    for (const tone of ["accent", "muted"] as const) expectSelectors(badgeClass(tone));
    for (const tone of ["warn", "ok", "muted"] as const) expectSelectors(previewBadgeClass(tone));
    for (const s of ["loading", "truncated", ...HONEST_STATUSES] as const) expectSelectors(treeNoteRowClass(s, 2));
    expectSelectors(scopeItemClass(true));
    expectSelectors(scopeItemClass(false));
  });

  test("a tree note carries its indent; the SAME honest class in the preview does not", () => {
    const inTree = treeNoteRowClass("unavailable" as HonestStatus, 2);
    expect(inTree).toContain("my-files__d2");
    expect(honestNoteClass("unavailable")).not.toContain("my-files__d");
  });
});
