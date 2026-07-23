// @mythicalos/preact-ui — barrel. Mirrors the family's internal Preact atoms package's src/index.ts
// export surface (the frozen v0.1.0 contract BROKKR's future port depends on) plus the 7 new
// atoms graduated from design-export's proposed additions (Chip, Card, Avatar, StatusLine,
// SearchInput, Banner, Gauge — Task 6). Serve `@mythicalos/ui-core/styles.css` (after
// `@mythicalos/tokens`) so these components' classes resolve — this package ships no CSS of its own.

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
