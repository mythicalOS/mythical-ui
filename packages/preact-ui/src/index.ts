// @mythicalos/preact-ui — barrel. Mirrors the family's internal Preact atoms package's src/index.ts
// export surface (the frozen v0.1.0 contract BROKKR's future port depends on) plus the 7 new
// atoms graduated from design-export's proposed additions (Chip, Card, Avatar, StatusLine,
// SearchInput, Banner, Gauge — Task 6). Serve `@mythicalos/ui-core/styles.css` (after
// `@mythicalos/tokens`) so these components' classes resolve — this package ships no CSS of its own.

export { Button, buttonClass, type ButtonProps, type BtnVariant, type BtnState } from "./Button.js";
export {
  Input,
  Toggle,
  Checkbox,
  REVEAL_SHOW_LABEL,
  REVEAL_HIDE_LABEL,
  REVEAL_LABELS,
  type InputProps,
  type RevealLabels,
  type ToggleProps,
  type CheckboxProps,
} from "./Input.js";
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

// ── tags & chips (the design system's "Tags & chips" card): Tag · Flag · ChipDropdown ──
export {
  Tag,
  tagClass,
  tagCountText,
  tagRemoveLabel,
  TAG_PARTS,
  TAG_REMOVE_GLYPH,
  TAG_REMOVE_LABEL,
  TAG_TONES,
  TAG_SIZES,
  type TagProps,
  type TagTone,
  type TagSize,
} from "./Tag.js";
export { Flag, flagClass, FLAG_TONES, FLAG_PARTS, type FlagProps, type FlagTone } from "./Flag.js";
export {
  ChipDropdown,
  chipDropdownClass,
  chipDropdownValueText,
  CHIP_DROPDOWN_PARTS,
  CHIP_DROPDOWN_CARET,
  CHIP_DROPDOWN_EMPTY_VALUE,
  type ChipDropdownProps,
  type ChipDropdownState,
} from "./ChipDropdown.js";

// ── dropdown popover (ds/components-popover — registry row `popover` v1) ──
export {
  Popover,
  POPOVER_CARET,
  POPOVER_CHECK,
  POPOVER_EMPTY_VALUE,
  popoverTriggerClass,
  popoverPanelClass,
  popoverItemClass,
  popoverTriggerText,
  resolvePopoverPosition,
  type PopoverProps,
  type PopoverItem,
  type PopoverPosition,
} from "./Popover.js";

// ── file explorer & markdown preview (ds/components-file-explorer) ──
export {
  FileTree,
  FilePreview,
  FileScopePicker,
  deriveFileTreeRows,
  countFileRows,
  countLoadedFiles,
  previewMeta,
  previewBodyMode,
  buildBreadcrumb,
  breadcrumbSegments,
  formatFileSize,
  formatRelativeTime,
  type FileTreeProps,
  type FilePreviewProps,
  type FileScopePickerProps,
  type FileTreeMode,
  type FileTreeRootSpec,
  type FileTreeRow,
  type FileScopeOption,
  type DirState,
  type FilePreviewState,
  type PreviewBadgeState,
  type GitMark,
} from "./FileExplorer.js";

// ── session-card (design registry `session-card` v1) ──
export {
  SessionCard,
  ctxBand,
  ctxReading,
  ctxBarGeom,
  normalizeCtxThresholds,
  ctxMeterClass,
  ctxNoteText,
  ctxValueText,
  sessionAvatarInitial,
  sessionCardClass,
  sessionCardIsStale,
  sessionCardStale,
  sessionStatusText,
  sessionSpineSummary,
  sessionStatus,
  sessionStatusClass,
  sessionSubline,
  spineNodeClass,
  type SessionCardProps,
} from "./SessionCard.js";
export type {
  CtxThresholds,
  CtxBand,
  CtxBarTick,
  CtxBarGeom,
  SessionLifecycle,
  SessionActivity,
  SessionStatusTone,
  SessionStatusKey,
  SessionStatus,
  SessionStatusInput,
  SessionSpine,
  SpineNode,
  SpineSummary,
} from "@mythicalos/ui-core/logic";

// ── terminal set (ds/components-terminal v2): terminal · queue-row · send-bar ──
export {
  Terminal,
  TERM_CLASS,
  TERM_STALE_COPY,
  TERM_WAKE_UNAVAILABLE_COPY,
  transcriptView,
  type TerminalProps,
  type TranscriptSegment,
  type TermRow,
  type TermRowKind,
  type TermSource,
  type TermView,
} from "./Terminal.js";
export {
  QueuePanel,
  QueueRow,
  QUEUE_EMPTY_COPY,
  QUEUE_LOADING_COPY,
  QUEUE_STALE_COPY,
  QUEUE_UNAVAILABLE_COPY,
  canCancelRow,
  cancelReducer,
  queueBadgeClass,
  queueBadgeLabel,
  queueRowClass,
  queueView,
  shouldDisarmCancel,
  type QueuePanelProps,
  type QueueRowProps,
  type CancelEvent,
  type CancelState,
  type QueueItem,
  type QueueItemStatus,
  type QueueSource,
  type QueueUnavailableReason,
  type QueueView,
} from "./QueuePanel.js";
export {
  SendBar,
  DELIVERY_CLASSES,
  DELIVERY_HINT,
  SEND_DISABLED_FALLBACK,
  SEND_PLACEHOLDER,
  canSend,
  clearDraftOnSend,
  deliveryClassLabel,
  keyAction,
  sendPlaceholder,
  showDeliveryHint,
  type SendBarProps,
  type DeliveryClass,
  type KeyAction,
} from "./SendBar.js";
