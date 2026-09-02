// @mythicalos/ui-core — the file-explorer / markdown-preview derivations
// (ds/components-file-explorer.html). Framework-agnostic: tree flattening, node classification,
// path/breadcrumb composition, git marks, size/time formatting, the honest-state classification and
// every class string the bindings render. ZERO preact/react — both bindings import from here so they
// can never drift.
//
// ── WHAT THIS COMPONENT IS ────────────────────────────────────────────────────
// A READ-ONLY two-pane explorer: a rail (header + scope picker + lazy tree) and a preview pane
// (breadcrumb + size/mtime header + rendered body). Nothing here edits, moves, renames or deletes,
// and no derivation below emits an affordance that implies otherwise.
//
// ── THE TWO TREE MODES (the card's central distinction) ───────────────────────
// · "all-mounts" — the roots are the container's BIND MOUNTS, drawn mono + muted with the ⌂ glyph;
//   the git repos ONE LEVEL DOWN are drawn accent-strong with the ⎇ glyph.
// · "project"    — the selected project's REPOS ARE THE ROOTS (accent-strong, ⎇). A repo carries a
//   `primary` badge within its project, and a repo shared by several projects reports how many
//   reference it ("2 projects").
// These are not two skins of one tree: which nodes count as a repo differs, and so does the badge
// vocabulary. `classifyDirNode` is the single place that decides it.
//
// ── THE FOUR HONEST STATES ────────────────────────────────────────────────────
// `unavailable` · `empty` · `too-large` · `binary` are FIRST-CLASS OUTCOMES, not errors. Each gets
// its own distinct modifier class and its own sentence, and NONE of them is styled as a failure
// (see `honestNoteClass` — the tone is deliberately informational for all four). An unreadable
// directory and a binary file are things the filesystem legitimately contains; the component says so
// plainly instead of accusing the user of a fault.

// ── vocabulary ────────────────────────────────────────────────────────────────

/** Which tree the rail is drawing. See the header — the two differ in substance, not styling. */
export type FileTreeMode = "all-mounts" | "project";

/** What a row IS, once the mode + depth have been taken into account. */
export type FileNodeKind = "mount" | "repo" | "dir" | "file";

/** A git worktree mark, per the card's legend (`M` warn · `A` ok) plus the marks a real
 *  `git status` also produces. */
export type GitMark = "M" | "A" | "D" | "R" | "?";

/** The tone axis for a mark. Never "error": an uncommitted file is not a failure. */
export type GitMarkTone = "warn" | "ok" | "muted";

/** One root of the tree. In "all-mounts" mode these are the bind mounts; in "project" mode they are
 *  the selected project's repos. `primary` / `projectCount` are project-mode badge inputs and are
 *  ignored in all-mounts mode (a bind mount is not a repo and has no project membership). */
export interface FileTreeRootSpec {
  key: string;
  label: string;
  /** Project mode: this repo is its project's primary repo. */
  primary?: boolean;
  /** Project mode: how many projects reference this repo. Only reported when > 1 (shared). */
  projectCount?: number;
}

/** One entry inside a directory listing. `repo` lets a caller that actually KNOWS whether a
 *  directory is a git repo say so; when it is undefined the card's structural rule applies (see
 *  `classifyDirNode`). */
export interface FileTreeEntry {
  name: string;
  kind: "dir" | "file";
  repo?: boolean;
}

/** The state of ONE directory's listing. `unavailable` and a loaded-but-`entries: []` listing are
 *  two of the four honest states — an unreadable directory is not the same claim as an empty one,
 *  and the tree must never collapse them together. */
export type DirState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "loaded"; entries: readonly FileTreeEntry[]; truncated?: boolean };

/** The four honest states, named. Exported as a value so a caller (and this package's tests) can
 *  enumerate them rather than restate the list. */
export type HonestStatus = "unavailable" | "empty" | "too-large" | "binary";
export const HONEST_STATUSES: readonly HonestStatus[] = ["unavailable", "empty", "too-large", "binary"];

/** Whether a string names one of the four honest states. */
export function isHonestStatus(value: unknown): value is HonestStatus {
  return typeof value === "string" && (HONEST_STATUSES as readonly string[]).includes(value);
}

/** What the preview pane has to show. `text` is the only branch carrying content; the other four
 *  non-loading branches are the honest states. The caller ADAPTS its own file-content source into
 *  this union — the atom never fetches (see the package README / the component's props). */
export type FilePreviewState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "empty" }
  | { status: "too-large"; bytes?: number }
  | { status: "binary"; bytes?: number }
  | { status: "text"; text: string; bytes?: number; mtime?: number };

// ── glyphs ────────────────────────────────────────────────────────────────────

/** The directory glyph per node kind. A plain sub-directory deliberately carries NO glyph: the
 *  chevron already renders "▸", and repeating it would draw "▸ ▸ name". The bindings still emit the
 *  (empty) glyph cell so every row's name stays on one vertical rule. */
export const NODE_GLYPH: Record<"mount" | "repo" | "dir", string> = {
  mount: "⌂",
  repo: "⎇",
  dir: "",
};

/** The disclosure chevron — the card's ▾ / ▸. The WHOLE ROW is the hit target (the bindings render
 *  one button per row); this is the affordance, never a separate control. */
export const CHEVRON_OPEN = "▾";
export const CHEVRON_CLOSED = "▸";
export function chevronGlyph(open: boolean): string {
  return open ? CHEVRON_OPEN : CHEVRON_CLOSED;
}

/** The scope picker’s disclosure caret. Lives here, not in the bindings, so the two cannot drift. */
export const SCOPE_CARET = "⌄";

/** The scope-picker glyph for a mode: ⌂ for all-mounts, ◈ for a project. */
export function scopeGlyph(mode: FileTreeMode): string {
  return mode === "all-mounts" ? "⌂" : "◈";
}

/** A mono type glyph for a FILE row: `#` markdown · `{}` json · `·` anything else. */
export function fileGlyph(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "#";
  if (lower.endsWith(".json")) return "{}";
  return "·";
}

/** Whether a name should render as MARKDOWN rather than as plain mono text. */
export function isMarkdownName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

// ── path composition ──────────────────────────────────────────────────────────

/**
 * A stable identity for one node: root key + relative path, joined on NUL.
 *
 * The join is unambiguous — and `splitNodeId` is an exact inverse — precisely WHEN neither field
 * contains the separator. That is not assumed: `deriveFileTreeRows` screens every root key through
 * `isUsableRootKey` and every entry name through `isUsableEntryName`, so no id the component emits
 * can round-trip lossily. A caller building an id by hand from an UNSCREENED root key is outside
 * that guarantee (a key containing the separator splits back into a different pair) — screen with
 * `isUsableRootKey` first, exactly as the walk does.
 */
export const NODE_ID_SEP = "\u0000";

export function nodeId(rootKey: string, relPath: string): string {
  return `${rootKey}${NODE_ID_SEP}${relPath}`;
}

/** The inverse of `nodeId`, split at the FIRST NUL. A string without one is not a node id and
 *  yields null rather than a half-parsed pair. */
export function splitNodeId(id: string): { rootKey: string; relPath: string } | null {
  const i = id.indexOf(NODE_ID_SEP);
  if (i < 0) return null;
  return { rootKey: id.slice(0, i), relPath: id.slice(i + 1) };
}

/** Join a parent relative path with a child name (at a root, the bare name). */
export function childRelPath(relPath: string, name: string): string {
  return relPath.length > 0 ? `${relPath}/${name}` : name;
}

/** Split a relative path into its parent path and its own name
 *  (`"a/b/c"` ⇒ `{"a/b","c"}` · `"c"` ⇒ `{"","c"}`). */
export function parentRelPath(relPath: string): { parentRel: string; name: string } {
  const cut = relPath.lastIndexOf("/");
  return cut < 0 ? { parentRel: "", name: relPath } : { parentRel: relPath.slice(0, cut), name: relPath.slice(cut + 1) };
}

/** The ancestor DIRECTORIES of a relative file path, root-first and including the root itself:
 *  `"docs/api/x.md"` ⇒ `["", "docs", "docs/api"]`. */
export function ancestorRelPaths(relPath: string): string[] {
  const segs = relPath.split("/").filter((s) => s.length > 0);
  const out: string[] = [""];
  let cur = "";
  for (let i = 0; i + 1 < segs.length; i++) {
    cur = cur.length === 0 ? segs[i]! : `${cur}/${segs[i]!}`;
    out.push(cur);
  }
  return out;
}

// ── breadcrumb ────────────────────────────────────────────────────────────────

/** The card's breadcrumb separator — a wide-spaced "›". */
export const BREADCRUMB_SEP = "  ›  ";

/** Breadcrumb segments from a root label down through the path. The ROOT IS ALWAYS INCLUDED (the
 *  card: "Breadcrumb always includes the project root"), so a bare filename can never read as
 *  belonging to nowhere. */
export function breadcrumbSegments(rootLabel: string, relPath: string): string[] {
  return [rootLabel, ...relPath.split("/").filter((s) => s.length > 0)];
}

/** The breadcrumb as one string. */
export function buildBreadcrumb(rootLabel: string, relPath: string): string {
  return breadcrumbSegments(rootLabel, relPath).join(BREADCRUMB_SEP);
}

// ── node classification (the two modes' real difference) ──────────────────────

/** Classify a DIRECTORY node for the active mode.
 *
 *  · project mode    — depth 0 IS a repo (the card: the project's repos ARE the roots); deeper
 *                      directories are plain directories.
 *  · all-mounts mode — depth 0 is a bind MOUNT; the level immediately beneath it is where git repos
 *                      live, so depth 1 classifies as "repo"; deeper is a plain directory.
 *
 *  `entryRepo` is the caller's own knowledge and always wins when supplied: a data source that can
 *  actually tell a repo from an ordinary folder should say so, and a depth-1 directory that is NOT a
 *  repo then renders as the plain directory it is. When it is undefined the card's structural rule
 *  above applies. Pure. */
export function classifyDirNode(mode: FileTreeMode, depth: number, entryRepo?: boolean): "mount" | "repo" | "dir" {
  if (mode === "project") return depth === 0 ? "repo" : "dir";
  if (depth === 0) return "mount";
  if (depth === 1) return entryRepo === false ? "dir" : "repo";
  return entryRepo === true ? "repo" : "dir";
}

// ── badges ────────────────────────────────────────────────────────────────────

/** A pill on a repo row. `accent` = a claim about THIS project (primary); `muted` = a neutral fact
 *  about sharing. */
export interface FileRowBadge {
  text: string;
  tone: "accent" | "muted";
}

/** The badges for a repo row — PROJECT MODE ONLY, because both facts are statements about project
 *  membership and neither is meaningful for a bind mount.
 *
 *  · `primary`      — this repo is its project's primary repo.
 *  · `N projects`   — this repo is referenced by N (> 1) projects, i.e. it is shared.
 *
 *  Both can hold at once (a shared repo that is also primary here), and both are then rendered: they
 *  are independent facts, and suppressing the sharing count would hide it exactly where it matters
 *  most. Pure. */
export function repoBadges(root: FileTreeRootSpec, mode: FileTreeMode): FileRowBadge[] {
  if (mode !== "project") return [];
  const out: FileRowBadge[] = [];
  if (root.primary === true) out.push({ text: "primary", tone: "accent" });
  const n = root.projectCount;
  if (typeof n === "number" && Number.isFinite(n)) {
    // Floor BEFORE the shared test, not after: a fractional 1.9 would otherwise pass `> 1` and then
    // floor down to the nonsensical "1 projects" — a claim of sharing where there is none.
    const count = Math.floor(n);
    if (count > 1) out.push({ text: `${count} projects`, tone: "muted" });
  }
  return out;
}

export function badgeClass(tone: FileRowBadge["tone"]): string {
  return `my-files__badge my-files__badge--${tone}`;
}

// ── git marks ─────────────────────────────────────────────────────────────────

/** The tone for a mark, per the card's legend (`M` warn · `A` ok) extended to the marks a real
 *  status also yields. A RENAME reduces to one glyph whether it is staged or unstaged, so it takes
 *  the conservative `warn` rather than a false all-good green for still-uncommitted work. */
export function gitMarkTone(mark: GitMark): GitMarkTone {
  if (mark === "M" || mark === "R") return "warn";
  if (mark === "A") return "ok";
  return "muted"; // D, ?
}

/** A human word for a mark — the accessible name, because a bare "M" is opaque to a screen reader. */
export function gitMarkLabel(mark: GitMark): string {
  switch (mark) {
    case "M":
      return "modified";
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    default:
      return "untracked";
  }
}

/** The mono 10px mark cell's class. */
export function gitMarkClass(mark: GitMark): string {
  return `my-files__mark my-files__mark--${gitMarkTone(mark)}`;
}

/** The preview header's status pill. `clean` is only ever an HONEST clean — the caller passes it
 *  when the file's repo genuinely reported no change for it. When there is no git knowledge at all
 *  the caller passes null and NO pill renders, because a fabricated "unchanged" would be a claim
 *  nobody proved. */
export type PreviewBadgeState = { kind: "mark"; mark: GitMark } | { kind: "clean" } | null;

export interface PreviewBadge {
  text: string;
  tone: GitMarkTone;
}

export function previewBadge(state: PreviewBadgeState): PreviewBadge | null {
  if (state === null) return null;
  if (state.kind === "clean") return { text: "unchanged", tone: "muted" };
  return { text: gitMarkLabel(state.mark), tone: gitMarkTone(state.mark) };
}

export function previewBadgeClass(tone: GitMarkTone): string {
  return `my-files__pill my-files__pill--${tone}`;
}

// ── formatting (the card's size / mtime header) ───────────────────────────────

const BYTE_UNITS = ["KB", "MB", "GB", "TB", "PB"] as const;

/** Human file size — "512 B", "14.2 KB". A negative or non-finite input reads "0 B" rather than
 *  rendering NaN. Pure. */
export function formatFileSize(bytes: unknown): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${BYTE_UNITS[i] ?? "PB"}`;
}

/**
 * Relative time — "2m ago". `now` is injected so this stays pure and testable. A future timestamp
 * clamps to "0s ago" rather than rendering a negative age. Pure.
 *
 * Seconds-vs-milliseconds is disambiguated by magnitude, with the threshold at 1e11 rather than the
 * 1e12 some sibling surfaces use. 1e12 ms is 2001-09-09, so under that rule ANY millisecond
 * timestamp older than 2001 is mistaken for seconds, multiplied by 1000 into the far future, and
 * then clamped — reporting a genuinely old file as "0s ago", i.e. a plausible-looking lie. At 1e11
 * the seconds branch still covers every second-timestamp up to the year 5138, while millisecond
 * timestamps are read correctly all the way back to 1973.
 */
export const SECONDS_THRESHOLD = 1e11;
export function formatRelativeTime(t: unknown, now: number = Date.now()): string {
  if (t === null || t === undefined) return "—";
  const ms = typeof t === "number" ? (t < SECONDS_THRESHOLD ? t * 1000 : t) : Date.parse(String(t));
  if (!Number.isFinite(ms)) return String(t);
  let s = Math.floor((now - ms) / 1000);
  if (s < 0) s = 0;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── honest states ─────────────────────────────────────────────────────────────

/** Where an honest state is being reported. The SENTENCE differs ("this directory" vs "this file");
 *  the tone never does. */
export type HonestSurface = "dir" | "file";

/**
 * The sentence for an honest state. Plain, specific, and never apologetic — each says what IS true,
 * not what went wrong. `bytes` is woven in for the two size-bearing states when it is known.
 */
export function honestNoteText(status: HonestStatus, surface: HonestSurface = "file", bytes?: number): string {
  const size = bytes === undefined ? null : formatFileSize(bytes);
  switch (status) {
    case "unavailable":
      return surface === "dir" ? "This directory isn't available right now." : "This file isn't available right now.";
    case "empty":
      return surface === "dir" ? "This directory is empty." : "This file is empty.";
    case "too-large":
      return size === null ? "This file is too large to display here." : `This file is too large to display here (${size}).`;
    case "binary":
      return size === null ? "This is a binary file — no text preview." : `This is a binary file (${size}) — no text preview.`;
  }
}

/**
 * The class for an honest-state note. Every one of the four gets its OWN modifier (so each is
 * distinctly renderable and independently styleable) while the base class carries a single,
 * deliberately INFORMATIONAL tone.
 *
 * There is no `--error` / `--warn` variant here, and that is the point: an unreadable directory, an
 * empty file, an oversized file and a binary file are all ordinary things a filesystem contains. The
 * component reports them; it does not accuse. Pure.
 */
export function honestNoteClass(status: HonestStatus): string {
  return `my-files__note my-files__note--${status}`;
}

/** The note class for the tree's two NON-honest informational rows (an in-flight listing and a
 *  server-truncated one). Same neutral base — neither is a failure either. */
export function treeNoteClass(status: "loading" | "truncated"): string {
  return `my-files__note my-files__note--${status}`;
}

/** A note row INSIDE the tree — the note class plus the depth indent, so a note lines up under the
 *  node it describes instead of sitting flush against the rail. The indent is composed here rather
 *  than inside `honestNoteClass` because the same honest-state classes are reused by the PREVIEW
 *  pane, where a tree indent would be meaningless. */
export function treeNoteRowClass(status: "loading" | "truncated" | HonestStatus, depth: number): string {
  const base = status === "loading" || status === "truncated" ? treeNoteClass(status) : honestNoteClass(status);
  return `${base} ${indentClass(depth)}`;
}

/** The preview body's sentence for any state that has no content to render, or null for `text`
 *  (where the real content renders instead). */
export function previewNoteText(state: FilePreviewState): string | null {
  switch (state.status) {
    case "loading":
      return "Loading…";
    case "unavailable":
      return honestNoteText("unavailable", "file");
    case "empty":
      return honestNoteText("empty", "file");
    case "too-large":
      return honestNoteText("too-large", "file", state.bytes);
    case "binary":
      return honestNoteText("binary", "file", state.bytes);
    case "text":
      return null;
  }
}

/** The preview body note's class, or null for `text`. */
export function previewNoteClass(state: FilePreviewState): string | null {
  if (state.status === "text") return null;
  if (state.status === "loading") return treeNoteClass("loading");
  return honestNoteClass(state.status);
}

/**
 * The size/mtime the preview HEADER should show. The state's own values win where it carries them —
 * they describe the bytes actually on screen, so the header can never show a stale size next to
 * fresh content — and the caller's listing values (`fallback`) fill the rest.
 *
 * `too-large` / `binary` carry a size but no mtime (nothing was read), so the mtime falls back to
 * the listing's. A value that is genuinely unknown stays `undefined` rather than becoming a zero the
 * formatter would render as a real "0 B" / "56y ago". Pure.
 */
export function previewMeta(
  state: FilePreviewState,
  fallback: { bytes?: number; mtime?: number } = {},
): { bytes?: number; mtime?: number } {
  if (state.status === "text") {
    return { bytes: state.bytes ?? fallback.bytes, mtime: state.mtime ?? fallback.mtime };
  }
  if (state.status === "too-large" || state.status === "binary") {
    return { bytes: state.bytes ?? fallback.bytes, mtime: fallback.mtime };
  }
  return { bytes: fallback.bytes, mtime: fallback.mtime };
}

/**
 * How the preview should render the body — the SINGLE decision both bindings follow, so neither
 * re-derives it and the two cannot drift:
 *   · "note"     — there is no content to show (loading, or any of the honest states);
 *   · "markdown" — a markdown name AND a renderer to hand it to;
 *   · "plain"    — everything else, including a markdown file with NO renderer supplied.
 *
 * `hasMarkdownRenderer` is part of the decision rather than a binding-side afterthought: markdown
 * rendering is the caller's to provide, and without it the honest outcome is plain text — never the
 * component inventing a renderer or injecting raw HTML.
 */
export function previewBodyMode(
  name: string,
  state: FilePreviewState,
  hasMarkdownRenderer = true,
): "markdown" | "plain" | "note" {
  if (state.status !== "text") return "note";
  return isMarkdownName(name) && hasMarkdownRenderer ? "markdown" : "plain";
}

// ── row derivation ────────────────────────────────────────────────────────────

/** Depth-class ceiling — rows deeper than this share the last indent step rather than growing the
 *  stylesheet without bound. */
export const MAX_INDENT_DEPTH = 10;

/** Hard ceiling on TRAVERSAL depth. Unlike `MAX_INDENT_DEPTH` (a purely visual cap) this bounds the
 *  recursion itself, so no caller-supplied listing can walk the derivation into a stack overflow. */
export const MAX_TREE_DEPTH = 64;

/**
 * Whether an entry name is structurally usable as one path segment.
 *
 * An EMPTY name is the dangerous one: `childRelPath("", "")` returns `""`, which is the ROOT's own
 * relative path — so an expanded root listing itself as a nameless directory would re-enter the same
 * node id forever. A name containing "/" or a NUL is rejected for the same class of reason: it would
 * silently compose a path that addresses a different node than the one listed (and NUL would break
 * `nodeId`'s separator outright). None of these can name a real filesystem entry.
 */
export function isUsableEntryName(name: string): boolean {
  if (typeof name !== "string" || name.length === 0) return false;
  if (name.includes("/") || name.includes(NODE_ID_SEP)) return false;
  // "." and ".." are directory-table artefacts, never real entries. Composing them would yield a
  // non-canonical path (`docs/../x.md`) that is handed back through the selection callbacks and used
  // as a cache identity — a plausible-but-wrong address for a node that is really somewhere else.
  if (name === "." || name === "..") return false;
  return true;
}

/**
 * Whether a ROOT key can serve as half of a node id. This is what ENFORCES the invariant `nodeId`
 * documents: a key containing the NUL separator would make `splitNodeId` return a different pair
 * than went in (`"a\0b"` + `""` splits back to `"a"` + `"b\0"`), silently corrupting the identity
 * that `dirs` / `marks` are keyed by. Root keys are caller-supplied and generic, so the component
 * checks rather than assumes.
 */
export function isUsableRootKey(key: string): boolean {
  return typeof key === "string" && key.length > 0 && !key.includes(NODE_ID_SEP);
}

/** The indent class for a depth. */
export function indentClass(depth: number): string {
  const d = Number.isFinite(depth) ? Math.max(0, Math.min(Math.floor(depth), MAX_INDENT_DEPTH)) : 0;
  return `my-files__d${d}`;
}

/** A directory row's class. */
export function dirRowClass(kind: "mount" | "repo" | "dir", depth: number, selected = false): string {
  return `my-files__row my-files__row--dir my-files__row--${kind} ${indentClass(depth)}${selected ? " my-files__row--sel" : ""}`;
}

/** A file row's class. */
export function fileRowClass(depth: number, selected: boolean): string {
  return `my-files__row my-files__row--file ${indentClass(depth)}${selected ? " my-files__row--sel" : ""}`;
}

export interface FileTreeDirRow {
  type: "dir";
  id: string;
  rootKey: string;
  relPath: string;
  name: string;
  depth: number;
  kind: "mount" | "repo" | "dir";
  open: boolean;
  chevron: string;
  glyph: string;
  badges: FileRowBadge[];
  className: string;
}

export interface FileTreeFileRow {
  type: "file";
  id: string;
  rootKey: string;
  relPath: string;
  name: string;
  depth: number;
  glyph: string;
  mark: GitMark | null;
  selected: boolean;
  className: string;
}

export interface FileTreeNoteRow {
  type: "note";
  id: string;
  depth: number;
  /** `unavailable` / `empty` are two of the four honest states; `loading` / `truncated` are the
   *  tree's other two informational rows. */
  status: "loading" | "truncated" | HonestStatus;
  text: string;
  className: string;
}

export type FileTreeRow = FileTreeDirRow | FileTreeFileRow | FileTreeNoteRow;

export interface DeriveFileTreeInput {
  mode: FileTreeMode;
  roots: readonly FileTreeRootSpec[];
  /** Every known directory listing, keyed by `nodeId(rootKey, relPath)`. A root's own listing is
   *  keyed with `relPath: ""`. A key that is absent reads as "not fetched yet". */
  dirs: Readonly<Record<string, DirState>>;
  /** The node ids currently expanded. */
  expanded: ReadonlySet<string>;
  /** The previewed FILE's node id, if any. */
  selectedId?: string | null;
  /** Git marks keyed by `nodeId(rootKey, relPath)`. Absent = NO mark (never a fabricated clean). */
  marks?: Readonly<Record<string, GitMark>>;
}

/**
 * Flatten the tree into the ordered rows the bindings render. Depth-first, roots in the order given;
 * a closed node contributes only its own row.
 *
 * Every non-entry outcome becomes an explicit NOTE row rather than silence:
 *   · a listing still in flight        ⇒ `loading`
 *   · a listing that could not be read ⇒ `unavailable`   (honest state)
 *   · a listing that is genuinely empty⇒ `empty`         (honest state)
 *   · a listing the source capped      ⇒ `truncated`
 * An expanded node with NO cache entry at all is `loading`, because "the caller has not fetched it
 * yet" is exactly that and must never read as empty.
 *
 * Marks are applied only where the caller supplied one for that exact path — an absent mark renders
 * no glyph, never a fabricated "clean". Pure: no fetching, no caching, no policy about WHEN a
 * listing should be loaded (that is the product's lazy-expansion concern).
 */
export function deriveFileTreeRows(input: DeriveFileTreeInput): FileTreeRow[] {
  const { mode, roots, dirs, expanded, selectedId = null, marks = {} } = input;
  const rows: FileTreeRow[] = [];

  const markFor = (id: string): GitMark | null =>
    Object.prototype.hasOwnProperty.call(marks, id) ? (marks[id] as GitMark) : null;

  // OWN keys only — the same guard `markFor` applies. `dirs` is caller-supplied and may be a plain
  // object whose prototype chain carries a colliding node id; reading through it would render a
  // directory the caller never listed, or (worse) treat an unfetched node as loaded and so silently
  // replace the honest "Loading…" row with fabricated entries.
  const dirState = (id: string): DirState | undefined =>
    Object.prototype.hasOwnProperty.call(dirs, id) ? dirs[id] : undefined;

  const walk = (rootKey: string, relPath: string, name: string, depth: number, entryRepo: boolean | undefined, root: FileTreeRootSpec): void => {
    // Depth ceiling — belt and braces against a pathological listing. A real tree is nowhere near
    // this; without it a caller's malformed data could recurse until the stack overflows.
    if (depth > MAX_TREE_DEPTH) return;
    const id = nodeId(rootKey, relPath);
    const open = expanded.has(id);
    const kind = classifyDirNode(mode, depth, entryRepo);
    rows.push({
      type: "dir",
      id,
      rootKey,
      relPath,
      name,
      depth,
      kind,
      open,
      chevron: chevronGlyph(open),
      glyph: NODE_GLYPH[kind],
      // Badges are a statement about a ROOT repo's project membership; a nested directory never
      // carries them even when it classifies as a repo.
      badges: depth === 0 ? repoBadges(root, mode) : [],
      className: dirRowClass(kind, depth),
    });
    if (!open) return;

    const state = dirState(id);
    if (state === undefined || state.status === "loading") {
      rows.push({
        type: "note",
        id: `${id}\u0000note`,
        depth: depth + 1,
        status: "loading",
        text: "Loading…",
        className: treeNoteRowClass("loading", depth + 1),
      });
      return;
    }
    if (state.status === "unavailable") {
      rows.push({
        type: "note",
        id: `${id}\u0000note`,
        depth: depth + 1,
        status: "unavailable",
        text: honestNoteText("unavailable", "dir"),
        className: treeNoteRowClass("unavailable", depth + 1),
      });
      return;
    }
    // At the traversal ceiling the children cannot be rendered at all. Say so — an open directory
    // that silently showed nothing would read as empty, which is precisely the false claim the
    // depth bound must not introduce. Reported BEFORE the empty check for the same reason.
    if (depth + 1 > MAX_TREE_DEPTH) {
      rows.push({
        type: "note",
        id: `${id}\u0000depth`,
        depth,
        status: "truncated",
        text: "This tree is nested too deeply to show further levels.",
        className: treeNoteRowClass("truncated", depth),
      });
      return;
    }

    // EMPTY is a positive claim — "there is nothing here" — and only a COMPLETE listing can support
    // it. A truncated listing that happens to carry no entries proves nothing about the directory,
    // so it falls through to the truncated note alone rather than asserting both "this directory is
    // empty" and "some entries are hidden", which contradict each other.
    if (state.entries.length === 0 && state.truncated !== true) {
      rows.push({
        type: "note",
        id: `${id}\u0000note`,
        depth: depth + 1,
        status: "empty",
        text: honestNoteText("empty", "dir"),
        className: treeNoteRowClass("empty", depth + 1),
      });
      // a truncated-but-empty listing is still worth reporting below
    }
    // Names already emitted in THIS listing. A node id is (root, path), so two entries sharing a
    // name in one directory address the same node — even when their kinds differ, since a directory
    // "x" and a file "x" both compose to `<root>\0<parent>/x`. Emitting both would duplicate a
    // framework key (invalid keyed rendering) and make a click ambiguous between two rows; a
    // duplicated DIRECTORY would additionally re-emit its whole subtree. First occurrence wins, the
    // same order-defined rule applied to duplicate roots below.
    const seenNames = new Set<string>();
    for (const entry of state.entries) {
      // A structurally unusable name is dropped rather than composed into a path that would address
      // the wrong node (or, for the empty name, this very node — an infinite descent).
      if (!isUsableEntryName(entry.name)) continue;
      if (seenNames.has(entry.name)) continue;
      seenNames.add(entry.name);
      const childRel = childRelPath(relPath, entry.name);
      if (entry.kind === "dir") {
        walk(rootKey, childRel, entry.name, depth + 1, entry.repo, root);
      } else {
        const fid = nodeId(rootKey, childRel);
        rows.push({
          type: "file",
          id: fid,
          rootKey,
          relPath: childRel,
          name: entry.name,
          depth: depth + 1,
          glyph: fileGlyph(entry.name),
          mark: markFor(fid),
          selected: selectedId === fid,
          className: fileRowClass(depth + 1, selectedId === fid),
        });
      }
    }
    if (state.truncated === true) {
      rows.push({
        type: "note",
        id: `${id}\u0000trunc`,
        depth: depth + 1,
        status: "truncated",
        text: "This directory is very large — some entries are hidden.",
        className: treeNoteRowClass("truncated", depth + 1),
      });
    }
  };

  // A root whose key cannot round-trip through `nodeId` is dropped rather than rendered under a
  // corrupted identity — the same policy applied to malformed entry names below.
  //
  // DUPLICATE keys are dropped for the same reason: two roots sharing a key produce the SAME node id
  // for themselves and for every descendant, so they would collide in `dirs` / `marks`, render under
  // duplicate framework keys, and make expanding or selecting one silently act on the other. Only
  // the first occurrence is kept — a stable, order-defined choice.
  const seenRootKeys = new Set<string>();
  for (const root of roots) {
    if (!isUsableRootKey(root.key) || seenRootKeys.has(root.key)) continue;
    seenRootKeys.add(root.key);
    walk(root.key, "", root.label, 0, undefined, root);
  }
  return rows;
}

/** The number of FILE rows actually rendered — the rail header's default count, and the only one
 *  that is provably equal to what the operator can see. Pure. */
export function countFileRows(rows: readonly FileTreeRow[]): number {
  let n = 0;
  for (const row of rows) if (row.type === "file") n++;
  return n;
}

/**
 * Total FILE entries DISCOVERED across every cached listing — a different number from
 * `countFileRows`, and deliberately so.
 *
 * This counts what the caller has listed so far ANYWHERE in its cache, including directories that
 * are currently collapsed or no longer reachable from the active roots. It is therefore NOT the
 * count of visible rows and must not be presented as one: a collapsed `docs/` whose listing is
 * cached still contributes its files here while rendering none. `FileTree` defaults its header to
 * `countFileRows` for exactly that reason; pass this explicitly as `count` only when "files
 * discovered so far" is the number you actually mean.
 *
 * Malformed and duplicate names are excluded on the same tests the walk applies, and `Object.keys`
 * is own-enumerable only, matching the walk's own-key guard. Pure.
 */
export function countLoadedFiles(dirs: Readonly<Record<string, DirState>>): number {
  let n = 0;
  for (const key of Object.keys(dirs)) {
    const state = dirs[key]!;
    if (state.status !== "loaded") continue;
    // Same screening AND same per-listing name dedupe the walk applies, so the header can never
    // count a row the tree collapses away.
    const seen = new Set<string>();
    for (const e of state.entries) {
      if (!isUsableEntryName(e.name) || seen.has(e.name)) continue;
      seen.add(e.name);
      if (e.kind === "file") n++;
    }
  }
  return n;
}

// ── scope picker ──────────────────────────────────────────────────────────────

/** One option in the rail's scope picker. `count` is the option's root count (the card's right-hand
 *  number). `dividerAfter` draws the card's 1px rule — the caller decides where the grouping falls
 *  rather than this module guessing a vocabulary of scope keys it does not own. */
export interface FileScopeOption {
  key: string;
  label: string;
  count: number;
  dividerAfter?: boolean;
}

export function scopeItemClass(active: boolean): string {
  return active ? "my-files__scope-it my-files__scope-it--on" : "my-files__scope-it";
}
