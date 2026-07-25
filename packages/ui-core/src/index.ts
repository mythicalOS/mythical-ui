// @mythicalos/ui-core — barrel. The framework-agnostic core: pure logic + types only, ZERO
// `preact`/`react` imports (enforced by test/agnostic.test.ts). Both the Preact and React bindings
// import from here so they derive identical classes/behavior from one source.

export { buttonClass, type BtnVariant, type BtnState } from "./logic/button.js";

export {
  nextPollDelay,
  makePollEpochGuard,
  runPollTick,
  shouldResetEpoch,
  POLL_JITTER_RATIO,
  POLL_BACKOFF_CAP_MS,
  type PollResult,
  type PollEpochGuard,
  type PollTickIO,
} from "./logic/poll.js";

export { typedNameMatches, BULLET_ICON, type DialogBullet } from "./logic/dialog.js";

export {
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_GAP_PX,
  POPOVER_BREATHING_PX,
  POPOVER_EMPTY_VALUE,
  POPOVER_DEFAULT_POSITION,
  POPOVER_CLASS,
  resolvePopoverPlacement,
  resolvePopoverAlign,
  resolvePopoverPosition,
  samePopoverPosition,
  popoverTriggerClass,
  popoverPanelClass,
  popoverItemClass,
  popoverIds,
  popoverTriggerAria,
  popoverPanelAria,
  popoverMenuAria,
  popoverItemAria,
  popoverTriggerKeyAction,
  popoverPanelKeyAction,
  popoverKeyHandled,
  edgePopoverIndex,
  stepPopoverIndex,
  initialPopoverIndex,
  resolvePopoverIndex,
  popoverTriggerText,
  type PopoverItem,
  type PopoverPlacement,
  type PopoverAlign,
  type PopoverPosition,
  type PopoverRect,
  type PopoverSize,
  type PopoverViewport,
  type PopoverTriggerState,
  type PopoverIds,
  type PopoverTriggerAria,
  type PopoverPanelAria,
  type PopoverMenuAria,
  type PopoverItemAria,
  type PopoverTriggerKeyAction,
  type PopoverPanelKeyAction,
  type PopoverTriggerText,
  type PopoverTriggerTextOptions,
} from "./logic/popover.js";

export {
  composeToastText,
  TOAST_SEP,
  type ToastStatus,
  type ToastSpec,
  type ToastBus,
} from "./logic/toast.js";

export { gaugeTone, gaugeGeom, type GaugeGeom } from "./logic/gauge.js";

export {
  chipClass,
  statusLineClass,
  bannerClass,
  BANNER_ICON,
  type Tone,
  type ChipTone,
  type StatusTone,
  type BannerTone,
} from "./logic/tone.js";

// ── small atoms graduated out of a single product: save-bar, stat-tiles, git-chip ──
export {
  saveBarNote,
  saveBarDirty,
  saveBarClass,
  SAVE_BAR_PARTS,
  SAVE_BAR_SEP,
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  type SaveBarNote,
} from "./logic/save-bar.js";

export {
  statTilesClass,
  statTileClass,
  STAT_TILE_PARTS,
  formatStatCompact,
  formatStatCount,
  formatStatUsd,
  formatStatPercent,
  STAT_TILE_EMPTY,
  STAT_TILE_MINUS,
  type StatTile,
  type StatTileTone,
} from "./logic/stat-tiles.js";

export {
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
  type GitStatus,
  type GitFlag,
  type GitFlagTone,
  type GitChipState,
} from "./logic/git-chip.js";
