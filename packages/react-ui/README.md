# @mythicalos/react-ui

The mythicalOS **thin React bindings** over `@mythicalos/ui-core` — the executable component
layer's React half. Apache-2.0.

## The thin-binding principle

This package is render + framework wiring **only**. Every class string, poll-scheduling policy,
glyph map, typed-name-match decision, and toast text composition is derived by
`@mythicalos/ui-core`'s pure, framework-agnostic logic — this package never re-implements any of
it. A sibling `@mythicalos/preact-ui` binding renders the exact same markup from the exact same core
functions, so the two frameworks can never drift apart. Genuine React — no `preact/compat`.

`react`/`react-dom` are peer dependencies (the consuming app supplies the single instance); so is
`@mythicalos/tokens` (optional — only needed if you're not already loading it another way).

## Install

```sh
npm add @mythicalos/react-ui react react-dom
```

## Import

```tsx
import { Button, ToastProvider } from "@mythicalos/react-ui";

// serve, in order:
import "@mythicalos/tokens/tokens.css";
import "@mythicalos/ui-core/styles.css"; // this package ships NO CSS of its own
```

## Exports

- `Button` — 5 variants × 6 states, loading spinner, inert+aria-busy.
- `Input`, `Toggle`, `Checkbox` — inputs with the "unconfigured is a valid state" neutral empty.
- `MaskedSecretInput` — presence-only secret slots; the value never round-trips to the UI.
- `EmptyState` — the designed empty moments (spine motif; never an error tone).
- `ConfirmDialog` (+ `typedNameMatches`), `Scrim` — modal danger confirms (Esc cancels, safe action
  focused first, optional typed-name-match gate for irreversible deletes).
- `Toast`, `ToastProvider`, `composeToastText`, `ToastContext`, `useToast` — the toast bus.
- `usePoll`, `useInterval`, `shouldResetEpoch` — the request/response poll hooks.
- `Chip`, `Card`, `Avatar`, `StatusLine`, `SearchInput`, `Banner`, `Gauge` — the 7 atoms graduated
  from design-export's proposed additions.
- Public types: every `*Props` type, the tone/variant enums (`BtnVariant`/`BtnState`, `ChipTone`,
  `StatusTone`, `BannerTone`, `Tone`, `DialogBullet`, `ToastStatus`/`ToastSpec`/`ToastBus`), and the
  hook contracts (`PollResult`, `PollEpochGuard`, `PollTickIO`, `GaugeGeom`).
- Re-exported core support API — so a consumer can import everything it needs from this one
  package: `buttonClass`, `typedNameMatches`, `BULLET_ICON`, `composeToastText`, `TOAST_SEP`,
  `chipClass`, `statusLineClass`, `bannerClass`, `BANNER_ICON`, `gaugeTone`, `gaugeGeom`,
  `nextPollDelay`, `makePollEpochGuard`, `runPollTick`, `POLL_JITTER_RATIO`, `POLL_BACKOFF_CAP_MS`.

## Parity with the Preact sibling

`@mythicalos/react-ui` mirrors `@mythicalos/preact-ui`'s export surface name-for-name — same
components, same hooks, same re-exported core symbols, same `*Props` type names. Two small,
deliberate API deltas from porting Preact idioms to idiomatic React (documented in full in each
component's header comment):

- `Chip`/`Card`/`Avatar`'s passthrough class prop is `className` here, not `class` — the one
  intentional public-prop rename, because `className` is what every React consumer reaches for.
- `Input`/`SearchInput` keep the Preact binding's `onInput` prop **name** (so switching bindings
  doesn't rename props at every call site) but wire it internally to React's `onChange` — which
  fires on the same "every keystroke" cadence as the native `input` event Preact's `onInput`
  listens to, so behavior matches, only the DOM event name under the hood differs.

Every class string either binding renders is produced by the exact same `@mythicalos/ui-core`
function call — the two bindings cannot silently drift apart.

## Styles

This package ships **no stylesheet**. Serve `@mythicalos/ui-core/styles.css` (after
`@mythicalos/tokens`) — it carries every class this package's components emit, including the 7
atoms (`.my-chip`, `.my-status`, `.my-card`, `.my-avatar`, `.my-search`, `.my-banner`, `.my-gauge`).

## License

Apache-2.0.
