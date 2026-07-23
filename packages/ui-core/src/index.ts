// @mythicalos/ui-core — barrel. The framework-agnostic core: pure logic + types only, ZERO
// `preact`/`react` imports (enforced by test/agnostic.test.ts). Both the Preact and React bindings
// import from here so they derive identical classes/behavior from one source.

export { buttonClass, type BtnVariant, type BtnState } from "./logic/button.ts";

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
} from "./logic/poll.ts";

export { typedNameMatches, BULLET_ICON, type DialogBullet } from "./logic/dialog.ts";

export {
  composeToastText,
  TOAST_SEP,
  type ToastStatus,
  type ToastSpec,
  type ToastBus,
} from "./logic/toast.ts";

export { gaugeTone, gaugeGeom, type GaugeGeom } from "./logic/gauge.ts";

export { type Tone } from "./logic/tone.ts";
