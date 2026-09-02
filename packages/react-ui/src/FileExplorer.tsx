// @mythicalos/react-ui — file explorer & markdown preview (ds/components-file-explorer).
//
// React twin of packages/preact-ui/src/FileExplorer.tsx. Three READ-ONLY components:
// `FileScopePicker`, `FileTree` (rail: header + tree) and `FilePreview` (breadcrumb + size/mtime
// header + rendered body). Nothing here edits, moves, renames or deletes.
//
// RENDER + WIRING ONLY. Every row, class string, glyph, badge, breadcrumb, mark tone, formatted size
// and honest-state sentence comes from `@mythicalos/ui-core/logic` — never reimplemented here — so
// this binding and its Preact sibling produce identical markup.
//
// It does not fetch, poll, cache, or decide WHEN a directory should load; the caller owns its data
// source, its lazy-expansion policy and its own page/scroll frame. `expanded`, `selectedId` and the
// picker's `open` are props, not internal state.
//
// Preact→React prop delta (the same one this package already applies to Chip/Card/Avatar): the
// Preact sibling's passthrough `class` prop is named `className` here, and the `scope` slot takes a
// `ReactNode`.

import type { ReactNode } from "react";
import {
  badgeClass,
  breadcrumbSegments,
  buildBreadcrumb,
  countFileRows,
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
  SCOPE_CARET,
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
  countFileRows,
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
  options: readonly FileScopeOption[];
  activeKey: string;
  mode: FileTreeMode;
  open: boolean;
  onToggle?: (next: boolean) => void;
  onSelect?: (key: string) => void;
  onDismiss?: () => void;
  label?: string;
}

/** A plain disclosure of buttons — deliberately NOT an ARIA menu/listbox, whose roles would promise
 *  arrow-key behavior this does not implement. */
export function FileScopePicker(props: FileScopePickerProps) {
  const { options, activeKey, mode, open, onToggle, onSelect, onDismiss, label } = props;
  const active = options.find((o) => o.key === activeKey);
  const text = label ?? active?.label ?? "";
  const glyph = scopeGlyph(mode);
  const selectable = options.length > 1;

  return (
    <div
      className="my-files__scope"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) onDismiss?.();
      }}
    >
      {selectable ? (
        <button type="button" className="my-files__scope-btn" aria-expanded={open} onClick={() => onToggle?.(!open)}>
          <span className="my-files__scope-glyph" aria-hidden="true">{glyph}</span>
          <span className="my-files__scope-label">{text}</span>
          <span className="my-files__scope-caret" aria-hidden="true">{SCOPE_CARET}</span>
        </button>
      ) : (
        <div className="my-files__scope-static">
          <span className="my-files__scope-glyph" aria-hidden="true">{glyph}</span>
          <span className="my-files__scope-label">{text}</span>
        </div>
      )}
      {open && selectable ? (
        <div className="my-files__scope-menu">
          {options.map((o) => (
            <div key={o.key}>
              <button
                type="button"
                className={scopeItemClass(o.key === activeKey)}
                aria-current={o.key === activeKey}
                onClick={() => onSelect?.(o.key)}
              >
                <span className="my-files__scope-it-name">{o.label}</span>
                <span className="my-files__scope-it-count">{o.count}</span>
              </button>
              {o.dividerAfter === true ? <div className="my-files__scope-divider" aria-hidden="true" /> : null}
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
  /** Directory listings keyed by `nodeId(rootKey, relPath)`. An absent key reads as "not fetched
   *  yet" and draws a Loading… row, never an empty one. */
  dirs: Readonly<Record<string, DirState>>;
  expanded: ReadonlySet<string>;
  selectedId?: string | null;
  /** Git marks keyed by node id. An absent entry renders NO mark — never a fabricated clean. */
  marks?: Readonly<Record<string, GitMark>>;
  title?: string;
  count?: number;
  branch?: string;
  scope?: ReactNode;
  onToggleDir?: (node: { rootKey: string; relPath: string; id: string }) => void;
  onSelectFile?: (node: { rootKey: string; relPath: string; id: string; name: string }) => void;
  className?: string;
}

export function FileTree(props: FileTreeProps) {
  const { mode, roots, dirs, expanded, selectedId = null, marks, title = "Files", count, branch, scope, onToggleDir, onSelectFile } = props;
  const rows = deriveFileTreeRows({ mode, roots, dirs, expanded, selectedId, marks });
  // the rendered-row count — provably what the operator sees (countLoadedFiles is a
  // different, cache-wide number; see its doc)
  const total = count ?? countFileRows(rows);

  return (
    <div className={props.className === undefined ? "my-files__rail" : `my-files__rail ${props.className}`}>
      <div className="my-files__hd">
        <div className="my-files__ti">
          <span>{title}</span>
          <span className="my-files__count">· {total}</span>
          {branch === undefined ? null : (
            <span className="my-files__branch">
              <span className="my-files__branch-dot" aria-hidden="true" />
              {branch}
            </span>
          )}
        </div>
        {scope}
      </div>
      <div className="my-files__tree">{rows.map((row) => renderRow(row, onToggleDir, onSelectFile))}</div>
    </div>
  );
}

function renderRow(
  row: FileTreeRow,
  onToggleDir: FileTreeProps["onToggleDir"],
  onSelectFile: FileTreeProps["onSelectFile"],
): ReactNode {
  if (row.type === "note") {
    return (
      <div className={row.className} key={row.id}>
        {row.text}
      </div>
    );
  }
  if (row.type === "dir") {
    // The WHOLE ROW is the hit target — the chevron is the affordance, not a separate control.
    return (
      <button
        type="button"
        className={row.className}
        aria-expanded={row.open}
        key={row.id}
        onClick={() => onToggleDir?.({ rootKey: row.rootKey, relPath: row.relPath, id: row.id })}
      >
        <span className="my-files__chev" aria-hidden="true">{row.chevron}</span>
        <span className="my-files__glyph" aria-hidden="true">{row.glyph}</span>
        <span className="my-files__name">{row.name}</span>
        {row.badges.map((b) => (
          <span key={b.text} className={badgeClass(b.tone)}>{b.text}</span>
        ))}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={row.className}
      aria-current={row.selected}
      key={row.id}
      onClick={() => onSelectFile?.({ rootKey: row.rootKey, relPath: row.relPath, id: row.id, name: row.name })}
    >
      <span className="my-files__spacer" aria-hidden="true" />
      <span className="my-files__fglyph" aria-hidden="true">{row.glyph}</span>
      <span className="my-files__fname">{row.name}</span>
      {row.mark === null ? null : (
        // role="img" so the aria-label IS the accessible name — a bare "M" would otherwise be
        // announced as the opaque glyph rather than "modified".
        <span className={gitMarkClass(row.mark)} role="img" title={gitMarkLabel(row.mark)} aria-label={gitMarkLabel(row.mark)}>
          {row.mark}
        </span>
      )}
    </button>
  );
}


// ── preview pane ──────────────────────────────────────────────────────────────

export interface FilePreviewProps {
  /** Render this only when a file IS selected; the no-selection placeholder belongs to the page. */
  name: string;
  /** The breadcrumb head — the breadcrumb ALWAYS includes the root. */
  rootLabel: string;
  relPath: string;
  state: FilePreviewState;
  /** `null` (the default) renders NO pill — never a fabricated "unchanged". */
  badge?: PreviewBadgeState;
  bytes?: number;
  mtime?: number;
  now?: number;
  /** Absent ⇒ a `.md` file falls back to plain mono text rather than this component inventing a
   *  renderer (or injecting raw HTML). */
  renderMarkdown?: (text: string) => ReactNode;
  className?: string;
}

export function FilePreview(props: FilePreviewProps) {
  const { name, rootLabel, relPath, state, badge = null, now, renderMarkdown } = props;
  const meta = previewMeta(state, { bytes: props.bytes, mtime: props.mtime });
  const pill = previewBadge(badge);

  return (
    <div className={props.className === undefined ? "my-files__prev" : `my-files__prev ${props.className}`}>
      <div className="my-files__prev-hd">
        <div className="my-files__prev-main">
          <div className="my-files__crumb">{buildBreadcrumb(rootLabel, relPath)}</div>
          <div className="my-files__name-row">
            <b className="my-files__prev-name">{name}</b>
            {pill === null ? null : <span className={previewBadgeClass(pill.tone)}>{pill.text}</span>}
          </div>
        </div>
        <div className="my-files__meta">
          {meta.bytes === undefined ? null : <span>{formatFileSize(meta.bytes)}</span>}
          {meta.mtime === undefined ? null : <span>modified {formatRelativeTime(meta.mtime, now)}</span>}
        </div>
      </div>
      <div className="my-files__prev-bd">{previewBody(name, state, renderMarkdown)}</div>
    </div>
  );
}

/** The body for the current state. Every non-`text` branch is a note — including all four honest
 *  states, each with its own distinct class and none styled as a failure. */
function previewBody(
  name: string,
  state: FilePreviewState,
  renderMarkdown: FilePreviewProps["renderMarkdown"],
): ReactNode {
  // ONE decision, made in ui-core — this binding never re-derives it.
  const mode = previewBodyMode(name, state, renderMarkdown !== undefined);
  if (mode === "note") return <div className={previewNoteClass(state) ?? ""}>{previewNoteText(state)}</div>;
  // "note" covers every non-text state, so the text branch is what remains
  const text = (state as Extract<FilePreviewState, { status: "text" }>).text;
  if (mode === "markdown") return <div className="my-files__md">{renderMarkdown!(text)}</div>;
  return <pre className="my-files__pre">{text}</pre>;
}
