/** @jsxImportSource preact */
// @mythicalos/preact-ui — the git status chip (ds/components-git-chip.html): a bordered inline
// mono chip carrying `⎇ <branch>` and honest counter flags (warn-soft behind/uncommitted,
// error-soft unpushed, ok-soft clean).
//
// Extracted from the reference implementation in the reference product's session detail pane. Its
// `available:false` reason ENUM and copy table were one daemon's wire vocabulary; here the product
// maps its own reason to a sentence and passes it as `unavailableNote`. The honesty contract is
// design, not product, and is preserved by `@mythicalos/ui-core`'s `gitFlags`/`gitBranchLabel`:
// an absent status renders the unavailable arm, `null` behind/unpushed OMIT their flag (never
// "0 behind"), a `null` branch reads "detached HEAD", and a status that never reported its counters
// is NEVER collapsed into a green "clean ✓".

import {
  GIT_BRANCH_GLYPH,
  GIT_BRANCH_UNKNOWN,
  GIT_CHIP_PARTS,
  GIT_CLEAN_LABEL,
  GIT_DETACHED_LABEL,
  GIT_LOADING_NOTE,
  GIT_STALE_LABEL,
  GIT_STALE_TITLE,
  GIT_UNAVAILABLE_NOTE,
  gitBranchLabel,
  gitChipClass,
  gitChipNote,
  gitFlagClass,
  gitFlags,
  hasGitStatus,
  type GitFlag,
  type GitFlagTone,
  type GitStatus,
} from "@mythicalos/ui-core/logic";

export {
  gitBranchLabel,
  gitChipClass,
  gitChipNote,
  gitFlagClass,
  gitFlags,
  hasGitStatus,
  GIT_BRANCH_GLYPH,
  GIT_BRANCH_UNKNOWN,
  GIT_CHIP_PARTS,
  GIT_CLEAN_LABEL,
  GIT_DETACHED_LABEL,
  GIT_LOADING_NOTE,
  GIT_STALE_LABEL,
  GIT_STALE_TITLE,
  GIT_UNAVAILABLE_NOTE,
  type GitFlag,
  type GitFlagTone,
  type GitStatus,
};

export interface GitChipProps {
  /** The reported status. Absent — `undefined` OR `null`, so a "no data yet" slot can be passed
   *  straight through — ⇒ the honest unavailable arm, never a fabricated clean tree. */
  status?: GitStatus | null;
  /** Human copy for why there is no status. The product maps its own reason codes to this
   *  sentence; the atom carries no reason vocabulary of its own. */
  unavailableNote?: string;
  /** The first read has not returned yet — only used when there is no `status` and no note. */
  loading?: boolean;
  /** The shown status is RETAINED while the live read is failing: stale, not current. Flagged on
   *  both arms. */
  stale?: boolean;
  class?: string;
}

export function GitChip(props: GitChipProps) {
  const { status, stale = false, class: cls = "" } = props;
  const staleMark = stale ? (
    <span class={GIT_CHIP_PARTS.stale} title={GIT_STALE_TITLE}>
      {GIT_STALE_LABEL}
    </span>
  ) : null;

  if (hasGitStatus(status)) {
    const flags = gitFlags(status);
    return (
      <span class={`${gitChipClass({ stale })} ${cls}`}>
        <span class={GIT_CHIP_PARTS.branch}>
          {GIT_BRANCH_GLYPH} {gitBranchLabel(status.branch)}
        </span>
        {flags.length > 0 ? (
          <span class={GIT_CHIP_PARTS.flags}>
            {flags.map((f) => (
              <span class={gitFlagClass(f.tone)} key={f.label}>
                {f.label}
              </span>
            ))}
          </span>
        ) : null}
        {staleMark}
      </span>
    );
  }

  const note = gitChipNote({ unavailableNote: props.unavailableNote, loading: props.loading });
  return (
    <span class={`${gitChipClass({ unavailable: true, stale })} ${cls}`}>
      <span class={GIT_CHIP_PARTS.branch} title={note}>
        {GIT_BRANCH_GLYPH} {GIT_BRANCH_UNKNOWN}
      </span>
      <span class={GIT_CHIP_PARTS.note}>{note}</span>
      {staleMark}
    </span>
  );
}
