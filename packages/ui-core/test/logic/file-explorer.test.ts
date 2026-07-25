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
  countFileRows,
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
  isUsableEntryName,
  isUsableRootKey,
  MAX_TREE_DEPTH,
  NODE_ID_SEP,
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

const ROOT_K = "core";

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

  test("a FRACTIONAL count never claims sharing that isn't there (never '1 projects')", () => {
    // 1.9 must not pass the shared test and then floor down to a self-contradicting "1 projects"
    expect(repoBadges({ key: "a", label: "a", projectCount: 1.9 }, "project")).toEqual([]);
    expect(repoBadges({ key: "a", label: "a", projectCount: 2.7 }, "project")).toEqual([
      { text: "2 projects", tone: "muted" },
    ]);
    for (const n of [0.5, 1, 1.1, 1.99]) {
      expect(repoBadges({ key: "a", label: "a", projectCount: n }, "project")).toEqual([]);
    }
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

  test("previewBodyMode owns the renderer question too — no renderer means honest plain text", () => {
    const text: FilePreviewState = { status: "text", text: "# hi" };
    expect(previewBodyMode("a.md", text, true)).toBe("markdown");
    expect(previewBodyMode("a.md", text, false)).toBe("plain");
    expect(previewBodyMode("a.txt", text, true)).toBe("plain");
    // a non-text state is a note whatever the renderer situation
    expect(previewBodyMode("a.md", { status: "binary", bytes: 1 }, true)).toBe("note");
    expect(previewBodyMode("a.md", { status: "binary", bytes: 1 }, false)).toBe("note");
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

  // ── review-round-1 regressions ──
  test("a listing is read from OWN keys only — a polluted prototype cannot fabricate entries", () => {
    const id = nodeId(ROOT_K, "");
    const dirs = Object.create({
      [id]: { status: "loaded", entries: [{ name: "leaked.md", kind: "file" }] },
    }) as Record<string, DirState>;
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs,
      expanded: new Set([id]),
    });
    // the inherited "listing" must NOT be believed — the honest unfetched state stands
    expect(rows.map((r) => r.type)).toEqual(["dir", "note"]);
    expect(rows[1]).toMatchObject({ status: "loading" });
    expect(JSON.stringify(rows)).not.toContain("leaked.md");
  });

  test("a nameless directory entry cannot recurse the walk into a stack overflow", () => {
    const id = nodeId(ROOT_K, "");
    expect(() =>
      deriveFileTreeRows({
        mode: "project",
        roots: [{ key: ROOT_K, label: "core" }],
        dirs: { [id]: loaded([{ name: "", kind: "dir" }]) },
        expanded: new Set([id]),
      }),
    ).not.toThrow();
  });

  test("structurally unusable entry names are dropped rather than composed into a wrong path", () => {
    expect(isUsableEntryName("a.md")).toBe(true);
    expect(isUsableEntryName("")).toBe(false);
    expect(isUsableEntryName("a/b")).toBe(false);
    expect(isUsableEntryName(`a${NODE_ID_SEP}b`)).toBe(false);

    const id = nodeId(ROOT_K, "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: { [id]: loaded([{ name: "", kind: "file" }, { name: "a/b", kind: "file" }, { name: "ok.md", kind: "file" }]) },
      expanded: new Set([id]),
    });
    const files = rows.filter((r) => r.type === "file");
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ name: "ok.md" });
  });

  // ── review-round-2 regressions ──
  test("a root key that cannot round-trip through nodeId is dropped, not rendered corrupted", () => {
    expect(isUsableRootKey("work")).toBe(true);
    expect(isUsableRootKey("")).toBe(false);
    expect(isUsableRootKey(`a${NODE_ID_SEP}b`)).toBe(false);

    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: `a${NODE_ID_SEP}b`, label: "corrupt" }, { key: "ok", label: "ok" }],
      dirs: {},
      expanded: new Set(),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rootKey: "ok" });
  });

  test("DUPLICATE entry names within one listing are dropped — ids must stay unique tree-wide", () => {
    const id = nodeId(ROOT_K, "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: {
        [id]: loaded([
          { name: "x.md", kind: "file" },
          { name: "x.md", kind: "file" },
          // a DIRECTORY sharing a file's name composes to the same node id too
          { name: "x.md", kind: "dir" },
          { name: "y.md", kind: "file" },
        ]),
      },
      expanded: new Set([id]),
    });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.filter((r) => r.type === "file").map((r) => r.name)).toEqual(["x.md", "y.md"]);
  });

  test("a duplicated DIRECTORY entry cannot re-emit its whole subtree", () => {
    const rootId = nodeId(ROOT_K, "");
    const docsId = nodeId(ROOT_K, "docs");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: {
        [rootId]: loaded([{ name: "docs", kind: "dir" }, { name: "docs", kind: "dir" }]),
        [docsId]: loaded([{ name: "a.md", kind: "file" }, { name: "b.md", kind: "file" }]),
      },
      expanded: new Set([rootId, docsId]),
    });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    expect(rows.filter((r) => r.type === "file")).toHaveLength(2);
  });

  test("a TRUNCATED listing never also claims to be empty — the two contradict", () => {
    const id = nodeId(ROOT_K, "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: { [id]: loaded([], true) },
      expanded: new Set([id]),
    });
    const notes = rows.filter((r) => r.type === "note");
    expect(notes.map((n) => (n as { status: string }).status)).toEqual(["truncated"]);
    expect(JSON.stringify(rows)).not.toContain("is empty");
  });

  test("a COMPLETE empty listing still asserts the honest empty state", () => {
    const id = nodeId(ROOT_K, "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: { [id]: loaded([], false) },
      expanded: new Set([id]),
    });
    expect(rows.filter((r) => r.type === "note").map((n) => (n as { status: string }).status)).toEqual(["empty"]);
  });

  test("countFileRows is the visible count; countLoadedFiles is the cache-wide one", () => {
    const rootId = nodeId(ROOT_K, "");
    const docsId = nodeId(ROOT_K, "docs");
    const dirs: Record<string, DirState> = {
      [rootId]: loaded([{ name: "docs", kind: "dir" }, { name: "top.md", kind: "file" }]),
      // cached but its directory is CLOSED — discovered, not visible
      [docsId]: loaded([{ name: "a.md", kind: "file" }]),
    };
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs,
      expanded: new Set([rootId]), // docs stays collapsed
    });
    expect(countFileRows(rows)).toBe(1); // only top.md is on screen
    expect(countLoadedFiles(dirs)).toBe(2); // top.md + the cached, unrendered a.md
    // the visible count always equals the rendered file rows, by construction
    expect(countFileRows(rows)).toBe(rows.filter((r) => r.type === "file").length);
  });

  test("the header count still matches rendered rows once duplicates are collapsed", () => {
    const dirs: Record<string, DirState> = {
      [nodeId(ROOT_K, "")]: loaded([
        { name: "x.md", kind: "file" },
        { name: "x.md", kind: "file" },
        { name: "y.md", kind: "file" },
      ]),
    };
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs,
      expanded: new Set([nodeId(ROOT_K, "")]),
    });
    const rendered = rows.filter((r) => r.type === "file").length;
    expect(countFileRows(rows)).toBe(rendered);
    expect(rendered).toBe(2);
  });

  test("DUPLICATE root keys are dropped — colliding ids would act on the wrong root", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [
        { key: "core", label: "first", primary: true },
        { key: "core", label: "second" },
        { key: "other", label: "other" },
      ],
      dirs: {},
      expanded: new Set(),
    });
    expect(rows).toHaveLength(2);
    // the FIRST occurrence wins — a stable, order-defined choice
    expect(rows[0]).toMatchObject({ rootKey: "core", name: "first" });
    expect(rows[1]).toMatchObject({ rootKey: "other" });
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  test("duplicate roots cannot make one root's subtree render under another's identity", () => {
    const id = nodeId("core", "");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "first" }, { key: "core", label: "second" }],
      dirs: { [id]: loaded([{ name: "a.md", kind: "file" }]) },
      expanded: new Set([id]),
    });
    // exactly one root + one file, not a duplicated subtree
    expect(rows.filter((r) => r.type === "file")).toHaveLength(1);
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  test("every id the walk emits round-trips exactly — the nodeId invariant is enforced, not assumed", () => {
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: "core", label: "core" }],
      dirs: {
        [nodeId("core", "")]: loaded([{ name: "docs", kind: "dir" }]),
        [nodeId("core", "docs")]: loaded([{ name: "x.md", kind: "file" }]),
      },
      expanded: new Set([nodeId("core", ""), nodeId("core", "docs")]),
    });
    for (const row of rows) {
      if (row.type === "note") continue;
      expect(splitNodeId(row.id)).toEqual({ rootKey: row.rootKey, relPath: row.relPath });
    }
  });

  test('"." and ".." are never composed into a non-canonical path', () => {
    expect(isUsableEntryName(".")).toBe(false);
    expect(isUsableEntryName("..")).toBe(false);
    expect(isUsableEntryName("...")).toBe(true); // a legal, ordinary name
    const id = nodeId(ROOT_K, "docs");
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs: {
        [nodeId(ROOT_K, "")]: loaded([{ name: "docs", kind: "dir" }]),
        [id]: loaded([{ name: "..", kind: "dir" }, { name: ".", kind: "dir" }, { name: "x.md", kind: "file" }]),
      },
      expanded: new Set([nodeId(ROOT_K, ""), id]),
    });
    expect(rows.map((r) => ("relPath" in r ? r.relPath : null)).filter(Boolean)).not.toContain("docs/..");
    expect(JSON.stringify(rows)).not.toContain("docs/..");
  });

  test("the header count never claims a file the tree does not render", () => {
    const dirs: Record<string, DirState> = {
      [nodeId(ROOT_K, "")]: loaded([
        { name: "", kind: "file" },
        { name: "a/b", kind: "file" },
        { name: ".", kind: "file" },
        { name: "real.md", kind: "file" },
      ]),
    };
    const rows = deriveFileTreeRows({
      mode: "project",
      roots: [{ key: ROOT_K, label: "core" }],
      dirs,
      expanded: new Set([nodeId(ROOT_K, "")]),
    });
    const rendered = rows.filter((r) => r.type === "file").length;
    expect(countFileRows(rows)).toBe(rendered);
    expect(rendered).toBe(1);
  });

  test("traversal depth is bounded even for a pathologically deep listing", () => {
    const dirs: Record<string, DirState> = {};
    const expanded = new Set<string>();
    let rel = "";
    for (let i = 0; i < MAX_TREE_DEPTH + 20; i++) {
      const id = nodeId(ROOT_K, rel);
      dirs[id] = loaded([{ name: `d${i}`, kind: "dir" }]);
      expanded.add(id);
      rel = rel.length === 0 ? `d${i}` : `${rel}/d${i}`;
    }
    const rows = deriveFileTreeRows({ mode: "project", roots: [{ key: ROOT_K, label: "core" }], dirs, expanded });
    expect(Math.max(...rows.map((r) => r.depth))).toBeLessThanOrEqual(MAX_TREE_DEPTH + 1);
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

  test("a pre-2001 MILLISECOND timestamp reads as old, not as the '0s ago' lie", () => {
    const now = 1_780_000_000_000; // 2026
    const y2k = 946_684_800_000; // 2000-01-01 in ms — below the old 1e12 threshold
    expect(formatRelativeTime(y2k, now)).not.toBe("0s ago");
    expect(formatRelativeTime(y2k, now)).toMatch(/^\d+d ago$/);
  });

  test("second-precision timestamps are still read as seconds", () => {
    const nowMs = 1_780_000_000_000;
    const twoMinAgoSec = Math.floor(nowMs / 1000) - 120;
    expect(formatRelativeTime(twoMinAgoSec, nowMs)).toBe("2m ago");
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
