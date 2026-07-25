/** @jsxImportSource preact */
// packages/preact-ui/file-explorer.test.tsx — the file-explorer binding (ds/components-file-explorer).
//
// This binding is render + wiring ONLY, so these tests assert two things:
//   (1) the markup is 100% derived from @mythicalos/ui-core/logic (the anti-drift guarantee), and
//   (2) the component is honest and READ-ONLY: all four honest states render distinctly through the
//       real component, no state is painted as a failure, and nothing offers an edit affordance.

import { describe, expect, test } from "bun:test";
import { render } from "preact-render-to-string";
import {
  buildBreadcrumb,
  deriveFileTreeRows,
  fileRowClass,
  formatFileSize,
  formatRelativeTime,
  gitMarkClass,
  honestNoteClass,
  honestNoteText,
  nodeId,
  previewBadgeClass,
  scopeItemClass,
  type DirState,
  type FilePreviewState,
  type FileScopeOption,
} from "@mythicalos/ui-core/logic";
import { FilePreview, FileScopePicker, FileTree } from "./src/index.ts";

const ROOT = "core";
const rootId = nodeId(ROOT, "");
const loaded = (entries: Array<{ name: string; kind: "dir" | "file"; repo?: boolean }>, truncated = false): DirState => ({
  status: "loaded",
  entries,
  truncated,
});

// ── the two tree modes render as the card draws them ──────────────────────────

describe("FileTree — the two tree modes", () => {
  test("all-mounts: the mount root is a mount row, the level below it is a repo row", () => {
    const html = render(
      <FileTree
        mode="all-mounts"
        roots={[{ key: "work", label: "/work" }]}
        dirs={{ [nodeId("work", "")]: loaded([{ name: "core", kind: "dir" }]) }}
        expanded={new Set([nodeId("work", "")])}
      />,
    );
    expect(html).toContain("my-files__row--mount");
    expect(html).toContain("my-files__row--repo");
    expect(html).toContain("⌂");
    expect(html).toContain("⎇");
    expect(html).toContain("/work");
  });

  test("project: repos are the roots and carry primary / shared badges", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[
          { key: "core", label: "core", primary: true },
          { key: "docs", label: "docs-site", projectCount: 2 },
        ]}
        dirs={{}}
        expanded={new Set()}
      />,
    );
    expect(html).toContain("my-files__badge--accent");
    expect(html).toContain("primary");
    expect(html).toContain("my-files__badge--muted");
    expect(html).toContain("2 projects");
    // a project-mode root is a repo, never a mount
    expect(html).toContain("my-files__row--repo");
    expect(html).not.toContain("my-files__row--mount");
  });

  test("all-mounts mode shows NO project badges — a bind mount has no project membership", () => {
    const html = render(
      <FileTree
        mode="all-mounts"
        roots={[{ key: "work", label: "/work", primary: true, projectCount: 3 }]}
        dirs={{}}
        expanded={new Set()}
      />,
    );
    expect(html).not.toContain("my-files__badge");
    expect(html).not.toContain("primary");
  });

  test("the rendered rows are exactly what deriveFileTreeRows returns (no local class strings)", () => {
    const props = {
      mode: "project" as const,
      roots: [{ key: ROOT, label: "core" }],
      dirs: { [rootId]: loaded([{ name: "a.md", kind: "file" as const }]) },
      expanded: new Set([rootId]),
      selectedId: nodeId(ROOT, "a.md"),
    };
    const html = render(<FileTree {...props} />);
    for (const row of deriveFileTreeRows(props)) {
      expect(html).toContain(`class="${row.className}"`);
    }
    // and the selected file's class is the core-derived one, verbatim
    expect(html).toContain(`class="${fileRowClass(1, true)}"`);
  });
});

// ── read-only + hit target ────────────────────────────────────────────────────

describe("FileTree — read-only, whole-row hit target", () => {
  test("the whole row is ONE button; the chevron is not a separate control", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
      />,
    );
    // one <button> per row (1 dir + 1 file); the chevron rides inside it as aria-hidden
    expect(html.match(/<button/g) ?? []).toHaveLength(2);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('<span class="my-files__chev" aria-hidden="true">▾</span>');
  });

  test("nothing offers an edit / delete / rename affordance", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
      />,
    ).toLowerCase();
    for (const forbidden of ["<input", "<textarea", "contenteditable", "delete", "rename", "upload", "new file"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("a mark carries a human accessible name, not the opaque glyph", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
        marks={{ [nodeId(ROOT, "a.md")]: "M" }}
      />,
    );
    expect(html).toContain(gitMarkClass("M"));
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="modified"');
  });

  test("no mark data ⇒ no mark rendered (never a fabricated clean)", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
      />,
    );
    expect(html).not.toContain("my-files__mark");
  });

  test("the header count defaults to the honest count of files actually listed", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }, { name: "b.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
        branch="main"
      />,
    );
    expect(html).toContain("· 2");
    expect(html).toContain("my-files__branch");
    expect(html).toContain("main");
  });
});

// ── the four honest states, through the real components ───────────────────────

describe("the four honest states each render distinctly through the component", () => {
  test("honest state 1/4 — UNAVAILABLE renders in the tree, and not as a failure", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: { status: "unavailable" } }}
        expanded={new Set([rootId])}
      />,
    );
    expect(html).toContain("my-files__note--unavailable");
    expect(html).toContain(honestNoteText("unavailable", "dir"));
    expect(html).not.toContain("error");
    expect(html).not.toContain("--warn");
  });

  test("honest state 2/4 — EMPTY renders in the tree, distinct from unavailable", () => {
    const html = render(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([]) }}
        expanded={new Set([rootId])}
      />,
    );
    expect(html).toContain("my-files__note--empty");
    expect(html).toContain("This directory is empty.");
    expect(html).not.toContain("my-files__note--unavailable");
  });

  test("honest state 3/4 — TOO-LARGE renders in the preview with its size", () => {
    const html = renderPreview({ status: "too-large", bytes: 14_540_000 });
    expect(html).toContain(honestNoteClass("too-large"));
    expect(html).toContain("too large to display here");
    expect(html).toContain("13.9 MB");
    expect(html).not.toContain("error");
  });

  test("honest state 4/4 — BINARY renders in the preview with its size", () => {
    const html = renderPreview({ status: "binary", bytes: 2048 });
    expect(html).toContain(honestNoteClass("binary"));
    expect(html).toContain("binary file");
    expect(html).toContain("no text preview");
    expect(html).not.toContain("error");
  });

  test("all four produce DIFFERENT markup — none collapses into another", () => {
    const outs = [
      renderPreview({ status: "unavailable" }),
      renderPreview({ status: "empty" }),
      renderPreview({ status: "too-large", bytes: 1 }),
      renderPreview({ status: "binary", bytes: 1 }),
    ];
    expect(new Set(outs).size).toBe(4);
  });

  test("no honest state is ever painted with an error/warn/danger class", () => {
    const states: FilePreviewState[] = [
      { status: "unavailable" },
      { status: "empty" },
      { status: "too-large", bytes: 1 },
      { status: "binary", bytes: 1 },
    ];
    for (const s of states) {
      const html = renderPreview(s);
      expect(html).not.toContain("my-files__note--error");
      expect(html).not.toContain("my-banner--error");
      expect(html).not.toContain("my-chip--error");
    }
  });
});

function renderPreview(state: FilePreviewState, extra: Record<string, unknown> = {}): string {
  return render(<FilePreview name="delivery-envelope.md" rootLabel="/work" relPath="core/docs/delivery-envelope.md" state={state} {...extra} />);
}

// ── preview header + body ─────────────────────────────────────────────────────

describe("FilePreview", () => {
  test("the breadcrumb always includes the root and is core-derived", () => {
    const html = renderPreview({ status: "loading" });
    expect(html).toContain(buildBreadcrumb("/work", "core/docs/delivery-envelope.md"));
    expect(html).toContain("/work");
  });

  test("the size / mtime header is core-formatted", () => {
    const now = 1_700_000_000_000;
    const html = renderPreview({ status: "text", text: "x", bytes: 14_540, mtime: now - 120_000 }, { now });
    expect(html).toContain(formatFileSize(14_540));
    expect(html).toContain(`modified ${formatRelativeTime(now - 120_000, now)}`);
    expect(html).toContain("2m ago");
  });

  test("an unknown size / mtime renders NOTHING rather than a misleading 0 B", () => {
    const html = renderPreview({ status: "text", text: "x" });
    expect(html).not.toContain("0 B");
    expect(html).not.toContain("modified");
  });

  test("the git pill: proven statuses render; no git knowledge renders NO pill", () => {
    expect(renderPreview({ status: "text", text: "x" }, { badge: { kind: "mark", mark: "M" } })).toContain(
      previewBadgeClass("warn"),
    );
    expect(renderPreview({ status: "text", text: "x" }, { badge: { kind: "clean" } })).toContain("unchanged");
    const none = renderPreview({ status: "text", text: "x" });
    expect(none).not.toContain("my-files__pill");
    expect(none).not.toContain("unchanged");
  });

  test("markdown renders through the caller's renderer", () => {
    const html = renderPreview(
      { status: "text", text: "# Delivery envelope" },
      { renderMarkdown: (t: string) => <h1>{t.replace("# ", "")}</h1> },
    );
    expect(html).toContain("my-files__md");
    expect(html).toContain("<h1>Delivery envelope</h1>");
  });

  test("WITHOUT a renderer a .md file degrades to plain text — never raw HTML injection", () => {
    const html = renderPreview({ status: "text", text: "<script>alert(1)</script>" });
    expect(html).toContain("my-files__pre");
    // the security-relevant character is `<` — escaping it is what stops a tag from ever forming.
    // (`>` is left literal, which is valid HTML and inert on its own.)
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script");
  });

  test("a non-markdown file always renders as plain mono text, even with a renderer supplied", () => {
    const html = render(
      <FilePreview
        name="mount-manifest.json"
        rootLabel="/work"
        relPath="core/mount-manifest.json"
        state={{ status: "text", text: "{}" }}
        renderMarkdown={(t) => <h1>{t}</h1>}
      />,
    );
    expect(html).toContain("my-files__pre");
    expect(html).not.toContain("<h1>");
  });
});

// ── scope picker ──────────────────────────────────────────────────────────────

describe("FileScopePicker", () => {
  const options: FileScopeOption[] = [
    { key: "all", label: "All mounts", count: 11, dividerAfter: true },
    { key: "p1", label: "mythical-dev", count: 6 },
    { key: "p2", label: "playbook-lab", count: 3 },
  ];

  test("open: every option renders with its count, the active one flagged", () => {
    const html = render(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open />);
    expect(html).toContain("my-files__scope-menu");
    expect(html).toContain("All mounts");
    expect(html).toContain("mythical-dev");
    expect(html).toContain(">11<");
    expect(html).toContain(scopeItemClass(true));
    expect(html).toContain("my-files__scope-divider");
  });

  test("the trigger glyph tracks the mode (⌂ all-mounts · ◈ project)", () => {
    expect(render(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open={false} />)).toContain("⌂");
    expect(render(<FileScopePicker options={options} activeKey="p1" mode="project" open={false} />)).toContain("◈");
  });

  test("with nothing to choose it renders a STATIC label, not a dead control", () => {
    const html = render(
      <FileScopePicker options={[{ key: "all", label: "All mounts", count: 2 }]} activeKey="all" mode="all-mounts" open />,
    );
    expect(html).toContain("my-files__scope-static");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("my-files__scope-menu");
  });

  test("it makes no ARIA menu/listbox claim it does not implement", () => {
    const html = render(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open />);
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('role="option"');
  });
});
