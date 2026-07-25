/** @jsxImportSource preact */
// @mythicalos/preact-ui — file explorer & markdown preview (ds/components-file-explorer).
//
// Three components, all READ-ONLY: `FileScopePicker` (the rail's scope dropdown), `FileTree` (the
// rail: header + tree) and `FilePreview` (breadcrumb + size/mtime header + rendered body). Nothing
// here edits, moves, renames or deletes, and none of them renders an affordance that implies it.
//
// RENDER + WIRING ONLY. Every row, class string, glyph, badge, breadcrumb, mark tone, formatted size
// and honest-state sentence is derived by `@mythicalos/ui-core/logic` so this binding and its React
// sibling can never drift.
//
// ── WHAT THIS COMPONENT DOES NOT DO ───────────────────────────────────────────
// It does not fetch, poll, cache, or decide WHEN a directory should be loaded. The caller owns its
// data source and lazy-expansion policy, and hands this component the tree it wants drawn (`dirs`)
// plus the file body it wants shown (`state`). It also owns its own page/scroll frame — these
// components render the rail and the pane, never the split or the scroller around them.
//
// ── CONTROLLED, ALWAYS ────────────────────────────────────────────────────────
// `expanded`, `selectedId` and the picker's `open` are props, not internal state. A product that
// restores "where I was", prunes a vanished node, or recovers focus after a poll shrinks the rail
// keeps that policy where it belongs — in the product.

import type { ComponentChildren } from "preact";
import {
  badgeClass,
  breadcrumbSegments,
  buildBreadcrumb,
  countLoadedFiles,
  deriveFileTreeRows,
  formatFileSize,
  formatRelativeTime,
  gitMarkClass,
  gitMarkLabel,
  previewBadge,
  previewBadgeClass,
  previewBodyMode,
  previewMeta,
  previewNoteClass,
  previewNoteText,
  scopeGlyph,
  scopeItemClass,
  type DirState,
  type FilePreviewState,
  type FileScopeOption,
  type FileTreeMode,
  type FileTreeRootSpec,
  type FileTreeRow,
  type GitMark,
  type PreviewBadgeState,
} from "@mythicalos/ui-core/logic";

export {
  breadcrumbSegments,
  buildBreadcrumb,
  countLoadedFiles,
  deriveFileTreeRows,
  formatFileSize,
  formatRelativeTime,
  previewBodyMode,
  previewMeta,
  type DirState,
  type FilePreviewState,
  type FileScopeOption,
  type FileTreeMode,
  type FileTreeRootSpec,
  type FileTreeRow,
  type GitMark,
  type PreviewBadgeState,
};

// ── scope picker ──────────────────────────────────────────────────────────────

export interface FileScopePickerProps {
  /** The offered scopes. With fewer than two the picker renders a STATIC label — there is nothing
   *  to choose, so no control is offered. */
  options: readonly FileScopeOption[];
  activeKey: string;
  /** The active scope's tree mode — drives the trigger glyph (⌂ all-mounts · ◈ project). */
  mode: FileTreeMode;
  open: boolean;
  onToggle?: (next: boolean) => void;
  onSelect?: (key: string) => void;
  /** Fired on Escape so the caller can close AND restore focus to wherever it wants it. */
  onDismiss?: () => void;
  label?: string;
}

/**
 * A plain disclosure of buttons — deliberately NOT an ARIA menu/listbox: those roles promise
 * arrow-key behavior this does not implement, and claiming them would be a lie to a screen reader.
 * Each option is a natively Tab/Enter-operable button.
 */
export function FileScopePicker(props: FileScopePickerProps) {
  const { options, activeKey, mode, open, onToggle, onSelect, onDismiss, label } = props;
  const active = options.find((o) => o.key === activeKey);
  const text = label ?? active?.label ?? "";
  const glyph = scopeGlyph(mode);
  const selectable = options.length > 1;

  return (
    <div
      class="my-files__scope"
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === "Escape" && open) onDismiss?.();
      }}
    >
      {selectable ? (
        <button type="button" class="my-files__scope-btn" aria-expanded={open} onClick={() => onToggle?.(!open)}>
          <span class="my-files__scope-glyph" aria-hidden="true">{glyph}</span>
          <span class="my-files__scope-label">{text}</span>
          <span class="my-files__scope-caret" aria-hidden="true">⌄</span>
        </button>
      ) : (
        <div class="my-files__scope-static">
          <span class="my-files__scope-glyph" aria-hidden="true">{glyph}</span>
          <span class="my-files__scope-label">{text}</span>
        </div>
      )}
      {open && selectable ? (
        <div class="my-files__scope-menu">
          {options.map((o) => (
            <div key={o.key}>
              <button
                type="button"
                class={scopeItemClass(o.key === activeKey)}
                aria-current={o.key === activeKey}
                onClick={() => onSelect?.(o.key)}
              >
                <span class="my-files__scope-it-name">{o.label}</span>
                <span class="my-files__scope-it-count">{o.count}</span>
              </button>
              {o.dividerAfter === true ? <div class="my-files__scope-divider" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── tree rail ─────────────────────────────────────────────────────────────────

export interface FileTreeProps {
  mode: FileTreeMode;
  roots: readonly FileTreeRootSpec[];
  /** Every known directory listing, keyed by `nodeId(rootKey, relPath)`. An absent key reads as
   *  "not fetched yet" and draws a Loading… row, never an empty one. */
  dirs: Readonly<Record<string, DirState>>;
  expanded: ReadonlySet<string>;
  selectedId?: string | null;
  /** Git marks keyed by node id. An absent entry renders NO mark — never a fabricated clean. */
  marks?: Readonly<Record<string, GitMark>>;
  title?: string;
  /** The header count. Defaults to the honest count of files actually listed so far. */
  count?: number;
  branch?: string;
  /** The scope picker (or anything else) for the rail header. */
  scope?: ComponentChildren;
  onToggleDir?: (node: { rootKey: string; relPath: string; id: string }) => void;
  onSelectFile?: (node: { rootKey: string; relPath: string; id: string; name: string }) => void;
  class?: string;
}

export function FileTree(props: FileTreeProps) {
  const { mode, roots, dirs, expanded, selectedId = null, marks, title = "Files", count, branch, scope, onToggleDir, onSelectFile } = props;
  const rows = deriveFileTreeRows({ mode, roots, dirs, expanded, selectedId, marks });
  const total = count ?? countLoadedFiles(dirs);

  return (
    <div class={props.class === undefined ? "my-files__rail" : `my-files__rail ${props.class}`}>
      <div class="my-files__hd">
        <div class="my-files__ti">
          <span>{title}</span>
          <span class="my-files__count">· {total}</span>
          {branch === undefined ? null : (
            <span class="my-files__branch">
              <span class="my-files__branch-dot" aria-hidden="true" />
              {branch}
            </span>
          )}
        </div>
        {scope}
      </div>
      <div class="my-files__tree">{rows.map((row) => renderRow(row, onToggleDir, onSelectFile))}</div>
    </div>
  );
}

function renderRow(
  row: FileTreeRow,
  onToggleDir: FileTreeProps["onToggleDir"],
  onSelectFile: FileTreeProps["onSelectFile"],
): ComponentChildren {
  if (row.type === "note") {
    return (
      <div class={row.className} key={row.id}>
        {row.text}
      </div>
    );
  }
  if (row.type === "dir") {
    // The WHOLE ROW is the hit target — the chevron is the affordance, not a separate control.
    return (
      <button
        type="button"
        class={row.className}
        aria-expanded={row.open}
        key={row.id}
        onClick={() => onToggleDir?.({ rootKey: row.rootKey, relPath: row.relPath, id: row.id })}
      >
        <span class="my-files__chev" aria-hidden="true">{row.chevron}</span>
        <span class="my-files__glyph" aria-hidden="true">{row.glyph}</span>
        <span class="my-files__name">{row.name}</span>
        {row.badges.map((b) => (
          <span key={b.text} class={badgeClass(b.tone)}>{b.text}</span>
        ))}
      </button>
    );
  }
  return (
    <button
      type="button"
      class={row.className}
      aria-current={row.selected}
      key={row.id}
      onClick={() => onSelectFile?.({ rootKey: row.rootKey, relPath: row.relPath, id: row.id, name: row.name })}
    >
      <span class="my-files__spacer" aria-hidden="true" />
      <span class="my-files__fglyph" aria-hidden="true">{row.glyph}</span>
      <span class="my-files__fname">{row.name}</span>
      {row.mark === null ? null : (
        // role="img" so the aria-label IS the accessible name — a bare "M" would otherwise be
        // announced as the opaque glyph rather than "modified".
        <span class={gitMarkClass(row.mark)} role="img" title={gitMarkLabel(row.mark)} aria-label={gitMarkLabel(row.mark)}>
          {row.mark}
        </span>
      )}
    </button>
  );
}


// ── preview pane ──────────────────────────────────────────────────────────────

export interface FilePreviewProps {
  /** The previewed file's name. Render this component only when a file IS selected; the
   *  no-selection placeholder belongs to the page, not to the component. */
  name: string;
  /** The breadcrumb head — the card: the breadcrumb ALWAYS includes the root. */
  rootLabel: string;
  relPath: string;
  state: FilePreviewState;
  /** The header pill. `null` (the default) renders NO pill — never a fabricated "unchanged". */
  badge?: PreviewBadgeState;
  /** Listing-derived fallbacks for the header, used where the state carries none. */
  bytes?: number;
  mtime?: number;
  /** Injected for deterministic relative times. */
  now?: number;
  /** Renders markdown to nodes. Absent ⇒ a `.md` file falls back to plain mono text rather than
   *  this component inventing a renderer (or, worse, injecting raw HTML). */
  renderMarkdown?: (text: string) => ComponentChildren;
  class?: string;
}

export function FilePreview(props: FilePreviewProps) {
  const { name, rootLabel, relPath, state, badge = null, now, renderMarkdown } = props;
  const meta = previewMeta(state, { bytes: props.bytes, mtime: props.mtime });
  const pill = previewBadge(badge);

  return (
    <div class={props.class === undefined ? "my-files__prev" : `my-files__prev ${props.class}`}>
      <div class="my-files__prev-hd">
        <div class="my-files__prev-main">
          <div class="my-files__crumb">{buildBreadcrumb(rootLabel, relPath)}</div>
          <div class="my-files__name-row">
            <b class="my-files__prev-name">{name}</b>
            {pill === null ? null : <span class={previewBadgeClass(pill.tone)}>{pill.text}</span>}
          </div>
        </div>
        <div class="my-files__meta">
          {meta.bytes === undefined ? null : <span>{formatFileSize(meta.bytes)}</span>}
          {meta.mtime === undefined ? null : <span>modified {formatRelativeTime(meta.mtime, now)}</span>}
        </div>
      </div>
      <div class="my-files__prev-bd">{previewBody(name, state, renderMarkdown)}</div>
    </div>
  );
}

/** The body for the current state. Every non-`text` branch is a note — including all four honest
 *  states, each with its own distinct class and none styled as a failure. */
function previewBody(
  name: string,
  state: FilePreviewState,
  renderMarkdown: FilePreviewProps["renderMarkdown"],
): ComponentChildren {
  // ONE decision, made in ui-core — this binding never re-derives it.
  const mode = previewBodyMode(name, state, renderMarkdown !== undefined);
  if (mode === "note") return <div class={previewNoteClass(state) ?? ""}>{previewNoteText(state)}</div>;
  // "note" covers every non-text state, so the text branch is what remains
  const text = (state as Extract<FilePreviewState, { status: "text" }>).text;
  if (mode === "markdown") return <div class="my-files__md">{renderMarkdown!(text)}</div>;
  return <pre class="my-files__pre">{text}</pre>;
}
