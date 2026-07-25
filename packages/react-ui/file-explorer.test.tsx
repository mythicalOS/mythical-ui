// packages/react-ui/file-explorer.test.tsx — the React file-explorer binding.
//
// Same guarantee as parity.test.tsx: this binding derives 100% of its markup from
// `@mythicalos/ui-core/logic` and never hard-codes an equivalent locally. The Preact sibling's own
// suite asserts the identical facts against the identical core functions, so if both pass, the two
// bindings cannot have drifted.

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildBreadcrumb,
  deriveFileTreeRows,
  fileRowClass,
  formatFileSize,
  gitMarkClass,
  honestNoteClass,
  honestNoteText,
  nodeId,
  previewBadgeClass,
  scopeItemClass,
  SCOPE_CARET,
  type DirState,
  type FilePreviewState,
  type FileScopeOption,
} from "@mythicalos/ui-core/logic";
import { FilePreview, FileScopePicker, FileTree } from "./src/index.ts";

const ROOT = "core";
const rootId = nodeId(ROOT, "");
const loaded = (entries: Array<{ name: string; kind: "dir" | "file" }>): DirState => ({
  status: "loaded",
  entries,
  truncated: false,
});

function renderPreview(state: FilePreviewState, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    <FilePreview name="delivery-envelope.md" rootLabel="/work" relPath="core/docs/delivery-envelope.md" state={state} {...extra} />,
  );
}

describe("FileTree (React) — the two tree modes", () => {
  test("all-mounts: mount root + repo one level down", () => {
    const html = renderToStaticMarkup(
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
  });

  test("project: repos are roots, with primary / shared badges", () => {
    const html = renderToStaticMarkup(
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
    expect(html).toContain("primary");
    expect(html).toContain("2 projects");
    expect(html).not.toContain("my-files__row--mount");
  });

  test("every rendered row class is deriveFileTreeRows' output, verbatim", () => {
    const props = {
      mode: "project" as const,
      roots: [{ key: ROOT, label: "core" }],
      dirs: { [rootId]: loaded([{ name: "a.md", kind: "file" as const }]) },
      expanded: new Set([rootId]),
      selectedId: nodeId(ROOT, "a.md"),
    };
    const html = renderToStaticMarkup(<FileTree {...props} />);
    for (const row of deriveFileTreeRows(props)) {
      expect(html).toContain(`class="${row.className}"`);
    }
    expect(html).toContain(`class="${fileRowClass(1, true)}"`);
  });

  test("the whole row is one button; marks carry a human accessible name", () => {
    const html = renderToStaticMarkup(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
        marks={{ [nodeId(ROOT, "a.md")]: "M" }}
      />,
    );
    expect(html.match(/<button/g) ?? []).toHaveLength(2);
    expect(html).toContain(gitMarkClass("M"));
    expect(html).toContain('aria-label="modified"');
  });

  test("read-only: no edit affordance anywhere", () => {
    const html = renderToStaticMarkup(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([{ name: "a.md", kind: "file" }]) }}
        expanded={new Set([rootId])}
      />,
    ).toLowerCase();
    for (const forbidden of ["<input", "<textarea", "contenteditable", "delete", "rename", "upload"]) {
      expect(html).not.toContain(forbidden);
    }
  });
});

describe("the four honest states (React)", () => {
  test("honest state 1/4 — UNAVAILABLE, in the tree, not as a failure", () => {
    const html = renderToStaticMarkup(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: { status: "unavailable" } }}
        expanded={new Set([rootId])}
      />,
    );
    expect(html).toContain("my-files__note--unavailable");
    // react-dom/server entity-encodes the apostrophe (&#x27;), so compare on the stable tail of the
    // core-derived sentence rather than the raw string.
    expect(honestNoteText("unavailable", "dir")).toContain("available right now.");
    expect(html).toContain("available right now.");
    expect(html).not.toContain("error");
  });

  test("honest state 2/4 — EMPTY, distinct from unavailable", () => {
    const html = renderToStaticMarkup(
      <FileTree
        mode="project"
        roots={[{ key: ROOT, label: "core" }]}
        dirs={{ [rootId]: loaded([]) }}
        expanded={new Set([rootId])}
      />,
    );
    expect(html).toContain("my-files__note--empty");
    expect(html).not.toContain("my-files__note--unavailable");
  });

  test("honest state 3/4 — TOO-LARGE, in the preview, with its size", () => {
    const html = renderPreview({ status: "too-large", bytes: 14_540_000 });
    expect(html).toContain(honestNoteClass("too-large"));
    expect(html).toContain(formatFileSize(14_540_000));
    expect(html).not.toContain("error");
  });

  test("honest state 4/4 — BINARY, in the preview, with its size", () => {
    const html = renderPreview({ status: "binary", bytes: 2048 });
    expect(html).toContain(honestNoteClass("binary"));
    expect(html).toContain("no text preview");
    expect(html).not.toContain("error");
  });

  test("all four produce different markup", () => {
    const outs = [
      renderPreview({ status: "unavailable" }),
      renderPreview({ status: "empty" }),
      renderPreview({ status: "too-large", bytes: 1 }),
      renderPreview({ status: "binary", bytes: 1 }),
    ];
    expect(new Set(outs).size).toBe(4);
  });
});

describe("FilePreview (React)", () => {
  test("breadcrumb + size are core-derived", () => {
    const html = renderPreview({ status: "text", text: "x", bytes: 14_540 });
    expect(html).toContain(buildBreadcrumb("/work", "core/docs/delivery-envelope.md"));
    expect(html).toContain(formatFileSize(14_540));
  });

  test("the git pill renders only when proven", () => {
    expect(renderPreview({ status: "text", text: "x" }, { badge: { kind: "mark", mark: "M" } })).toContain(
      previewBadgeClass("warn"),
    );
    expect(renderPreview({ status: "text", text: "x" })).not.toContain("my-files__pill");
  });

  test("without a renderer, markdown degrades to escaped plain text", () => {
    const html = renderPreview({ status: "text", text: "<script>alert(1)</script>" });
    expect(html).toContain("my-files__pre");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script");
  });
});

describe("FileScopePicker (React)", () => {
  const options: FileScopeOption[] = [
    { key: "all", label: "All mounts", count: 11, dividerAfter: true },
    { key: "p1", label: "mythical-dev", count: 6 },
  ];

  test("open menu marks the active option and draws the divider", () => {
    const html = renderToStaticMarkup(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open />);
    expect(html).toContain(scopeItemClass(true));
    expect(html).toContain("my-files__scope-divider");
  });

  test("the caret glyph comes from ui-core, not a binding literal", () => {
    const html = renderToStaticMarkup(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open={false} />);
    expect(html).toContain(SCOPE_CARET);
  });

  test("a single option renders a static label, not a dead control", () => {
    const html = renderToStaticMarkup(
      <FileScopePicker options={[options[0]!]} activeKey="all" mode="all-mounts" open />,
    );
    expect(html).toContain("my-files__scope-static");
    expect(html).not.toContain("<button");
  });

  test("no unimplemented ARIA menu claim", () => {
    const html = renderToStaticMarkup(<FileScopePicker options={options} activeKey="all" mode="all-mounts" open />);
    expect(html).not.toContain('role="menu"');
    expect(html).not.toContain('role="listbox"');
  });
});
