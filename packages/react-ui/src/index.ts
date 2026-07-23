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
