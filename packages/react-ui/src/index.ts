// @mythicalos/react-ui — barrel. React twin of packages/preact-ui/src/index.ts — the SAME export
// surface (components, hooks, re-exported core symbols, Props types) so the two bindings can never
// drift. The two intentional prop-name deltas (Chip/Card/Avatar's `class` → `className`) live on
// the component types themselves, not the barrel — see each file's header comment and the task
// report. Serve `@mythicalos/ui-core/styles.css` (after `@mythicalos/tokens`) so these components'
// classes resolve — this package ships no CSS of its own.

export { Button, buttonClass, type ButtonProps, type BtnVariant, type BtnState } from "./Button.js";
export { Input, Toggle, Checkbox, type InputProps, type ToggleProps, type CheckboxProps } from "./Input.js";
export { MaskedSecretInput, type MaskedSecretInputProps } from "./MaskedSecretInput.js";
export { EmptyState, type EmptyStateProps } from "./EmptyState.js";
export {
  Scrim,
  ConfirmDialog,
  typedNameMatches,
  BULLET_ICON,
  type DialogBullet,
  type ConfirmDialogProps,
} from "./ConfirmDialog.js";
export {
  Toast,
  ToastProvider,
  composeToastText,
  TOAST_SEP,
  type ToastProps,
} from "./Toast.js";
export {
  ToastContext,
  useToast,
  type ToastStatus,
  type ToastSpec,
  type ToastBus,
} from "./toast-context.js";
export {
  usePoll,
  useInterval,
  shouldResetEpoch,
  nextPollDelay,
  makePollEpochGuard,
  runPollTick,
  POLL_JITTER_RATIO,
  POLL_BACKOFF_CAP_MS,
  type PollResult,
  type PollEpochGuard,
  type PollTickIO,
} from "./hooks.js";

// ── the 7 new atoms (design-export's "proposed additions" — Task 6 graduation) ──
export { Chip, chipClass, type ChipProps, type ChipTone } from "./Chip.js";
export { Card, type CardProps } from "./Card.js";
export { Avatar, type AvatarProps } from "./Avatar.js";
export { StatusLine, statusLineClass, type StatusLineProps, type StatusTone } from "./StatusLine.js";
export { SearchInput, type SearchInputProps } from "./SearchInput.js";
export { Banner, bannerClass, BANNER_ICON, type BannerProps, type BannerTone } from "./Banner.js";
export { Gauge, gaugeTone, gaugeGeom, type GaugeProps, type GaugeGeom, type Tone } from "./Gauge.js";

// ── small atoms graduated out of a single product (save-bar / stat-tiles / git-chip cards) ──
export {
  SaveBar,
  saveBarNote,
  saveBarDirty,
  saveBarClass,
  SAVE_BAR_PARTS,
  SAVE_BAR_SEP,
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  type SaveBarProps,
  type SaveBarNote,
} from "./SaveBar.js";
export {
  StatTiles,
  statTilesClass,
  statTileClass,
  STAT_TILE_PARTS,
  formatStatCompact,
  formatStatCount,
  formatStatUsd,
  formatStatPercent,
  STAT_TILE_EMPTY,
  STAT_TILE_MINUS,
  type StatTilesProps,
  type StatTile,
  type StatTileTone,
} from "./StatTiles.js";
export {
  GitChip,
  gitFlags,
  hasGitStatus,
  gitBranchLabel,
  gitChipClass,
  gitFlagClass,
  gitChipNote,
  GIT_CHIP_PARTS,
  GIT_BRANCH_GLYPH,
  GIT_BRANCH_UNKNOWN,
  GIT_DETACHED_LABEL,
  GIT_CLEAN_LABEL,
  GIT_LOADING_NOTE,
  GIT_UNAVAILABLE_NOTE,
  GIT_STALE_LABEL,
  GIT_STALE_TITLE,
  type GitChipProps,
  type GitStatus,
  type GitFlag,
  type GitFlagTone,
} from "./GitChip.js";
