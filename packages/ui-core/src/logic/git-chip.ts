// @mythicalos/ui-core — the git status chip's flag derivation, branch label, copy and class
// derivation (ds/components-git-chip.html: a bordered inline mono chip — `⎇ <branch>` plus honest
// counter flags; warn-soft for behind/uncommitted, error-soft for unpushed, ok-soft for a clean
// tree — "never red unless something is actually wrong").
//
// Extracted from the reference implementation in the reference product's session detail pane. Two
// things were product-shaped there and are lifted out:
//   1. the `available:false` REASON VOCABULARY (`no_worktree`, `uid_isolation_unsupported`,
//      `session_terminal`, `slugless`, …) and its copy table — those are one daemon's wire enum.
//      The atom keeps the STATE and takes the human sentence as `unavailableNote`, so each product
//      maps its own reason codes to copy and the atom still renders the honest arm.
//   2. the session view-model envelope (`GitVm`) — replaced by the plain `GitStatus` below.
//
// What is DESIGN and therefore stays (the honesty contract — see gitFlags):
//   - `branch: null` is a DETACHED HEAD, rendered as such, never blank,
//   - `behind`/`unpushed` of `null` means NO UPSTREAM: that flag is OMITTED, never rendered "0
//     behind" (a `0` would claim an upstream comparison that never happened),
//   - an absent/unreported status is NEVER coerced into a zero-count "clean ✓" row — the chip
//     renders its unavailable arm (or, for a partially reported status, simply no flags).

/** Flag tone. Per the design card: warn = behind / uncommitted, error = unpushed ("a real error
 *  state"), ok = clean. */
export type GitFlagTone = "warn" | "error" | "ok";

export interface GitFlag {
  label: string;
  tone: GitFlagTone;
}

/** A reported git status. Every field is REQUIRED so a caller cannot half-report a tree and get a
 *  confident render — but each is also runtime-guarded, because a JS consumer can still pass
 *  `undefined`, and "not reported" must degrade to honest silence, never to a fabricated zero. */
export interface GitStatus {
  /** Branch name, or `null` for a detached HEAD. */
  branch: string | null;
  /** Commits behind upstream. `null` ⇒ there is NO upstream — the flag is omitted, not zeroed. */
  behind: number | null;
  /** Uncommitted working-tree changes. */
  uncommitted: number;
  /** Commits not pushed to upstream. `null` ⇒ there is NO upstream — the flag is omitted. */
  unpushed: number | null;
}

/** The branch glyph the card prefixes the name with. */
export const GIT_BRANCH_GLYPH = "⎇";
/** Shown in place of a branch name when there is no status to show at all. */
export const GIT_BRANCH_UNKNOWN = "—";
/** A `null` branch is a real, nameable state — never a blank. */
export const GIT_DETACHED_LABEL = "detached HEAD";
/** The all-clear flag (token rule #7: the ✓ glyph rides along with the ok-soft color). */
export const GIT_CLEAN_LABEL = "clean ✓";
/** Default copy while the first status read is in flight. */
export const GIT_LOADING_NOTE = "Checking repository status…";
/** Default copy when no status and no reason were supplied — deliberately says nothing about the
 *  tree's actual state. */
export const GIT_UNAVAILABLE_NOTE = "Repository status is unavailable.";
/** Marker for a RETAINED status shown while the live read is failing: what is on screen is the last
 *  received status, not the current one. */
export const GIT_STALE_LABEL = "· stale";
export const GIT_STALE_TITLE = "the last read failed — showing the last received status";

/** A real, non-negative INTEGER commit/file count. `null` (no upstream), `undefined` (not
 *  reported), `NaN`, negatives and fractions are all "not a count" — a fractional value cannot be a
 *  number of commits, so it is malformed data and must not be rendered as one ("1.5↓ behind"). */
function isCount(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0;
}

/** True when a status object was actually supplied. A JS caller can hand `null` where the type says
 *  `GitStatus | undefined` — `null` means "no status", so it must take the honest unavailable arm
 *  rather than crash on a field read. Both bindings gate on this. */
export function hasGitStatus(status: GitStatus | null | undefined): status is GitStatus {
  return typeof status === "object" && status !== null;
}

/** Branch label: the real name, or the honest "detached HEAD" for `null`. An unreported branch
 *  (`undefined`, or any non-string) falls back to the neutral `—` rather than inventing a checkout
 *  state. */
export function gitBranchLabel(branch: string | null | undefined): string {
  if (branch === null) return GIT_DETACHED_LABEL;
  if (typeof branch !== "string") return GIT_BRANCH_UNKNOWN;
  // A git ref name cannot contain whitespace, so blank-or-whitespace is the same malformed input as
  // `""` — it must not leave the branch slot visibly empty next to a confident status.
  return branch.trim().length > 0 ? branch : GIT_DETACHED_LABEL;
}

/** Counter flags in design order (behind · uncommitted · unpushed), collapsing to a single
 *  `clean ✓` when the tree is genuinely all-clear.
 *
 *  The clean claim is guarded: it is made ONLY when `uncommitted` was reported as 0 AND both
 *  upstream counters were reported at all — `null` counts as reported (it is the explicit "no
 *  upstream" answer), `undefined` does not. A status that never reported its counters therefore
 *  yields NO flags rather than a green "clean ✓" the caller never earned. */
export function gitFlags(status: GitStatus): GitFlag[] {
  const behind = status?.behind;
  const uncommitted = status?.uncommitted;
  const unpushed = status?.unpushed;

  const flags: GitFlag[] = [];
  if (isCount(behind) && behind > 0) flags.push({ label: `${behind}↓ behind`, tone: "warn" });
  if (isCount(uncommitted) && uncommitted > 0) {
    flags.push({ label: `${uncommitted} uncommitted`, tone: "warn" });
  }
  if (isCount(unpushed) && unpushed > 0) flags.push({ label: `${unpushed} unpushed`, tone: "error" });
  if (flags.length > 0) return flags;

  const reported = (n: unknown): boolean => n === null || isCount(n);
  const clean = isCount(uncommitted) && uncommitted === 0 && reported(behind) && reported(unpushed);
  return clean ? [{ label: GIT_CLEAN_LABEL, tone: "ok" }] : [];
}

export interface GitChipState {
  /** No status to show — the chip renders its note instead of flags. */
  unavailable?: boolean;
  /** The shown status is retained, not current. */
  stale?: boolean;
}

/** Every class the chip renders, root and elements — the bindings import these rather than
 *  spelling the strings themselves, so the two frameworks cannot drift apart on a rename. */
export const GIT_CHIP_PARTS = {
  root: "my-gitchip",
  branch: "my-gitchip__branch",
  flags: "my-gitchip__flags",
  flag: "my-gitchip__flag",
  note: "my-gitchip__note",
  stale: "my-gitchip__stale",
} as const;

/** Root class: base + the unavailable/stale modifiers. */
export function gitChipClass(state: GitChipState = {}): string {
  const base = GIT_CHIP_PARTS.root;
  let cls = base;
  if (state.unavailable === true) cls += ` ${base}--unavailable`;
  if (state.stale === true) cls += ` ${base}--stale`;
  return cls;
}

/** Flag badge class: base + tone modifier (always present — the tone IS the flag's meaning). */
export function gitFlagClass(tone: GitFlagTone): string {
  const base = GIT_CHIP_PARTS.flag;
  return `${base} ${base}--${tone}`;
}

/** The unavailable arm's sentence: a caller-supplied reason wins; else the loading line while the
 *  first read is in flight; else the neutral default. Never describes the tree. */
export function gitChipNote(o: { unavailableNote?: string; loading?: boolean } = {}): string {
  const note = o.unavailableNote;
  if (typeof note === "string" && note.trim().length > 0) return note;
  return o.loading === true ? GIT_LOADING_NOTE : GIT_UNAVAILABLE_NOTE;
}
