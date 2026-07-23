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
