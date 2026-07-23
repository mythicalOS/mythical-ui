# @mythicalos/preact-ui

The mythicalOS **thin Preact bindings** over `@mythicalos/ui-core` — the executable component
layer's Preact half. Apache-2.0.

## The thin-binding principle

This package is render + framework wiring **only**. Every class string, poll-scheduling policy,
glyph map, typed-name-match decision, and toast text composition is derived by
`@mythicalos/ui-core`'s pure, framework-agnostic logic — this package never re-implements any of
it. A sibling `@mythicalos/react-ui` binding renders the exact same markup from the exact same core
functions, so the two frameworks can never drift apart.

`preact` is a peer dependency (the consuming app supplies the single instance); so is
`@mythicalos/tokens` (optional — only needed if you're not already loading it another way).

## Install

```sh
npm add @mythicalos/preact-ui preact
```

## Import

```tsx
import { Button, ToastProvider } from "@mythicalos/preact-ui";

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
  package, exactly as it could from the internal, original `@mythicalos/preact-ui`:
  `buttonClass`, `typedNameMatches`, `BULLET_ICON`, `composeToastText`, `TOAST_SEP`, `chipClass`,
  `statusLineClass`, `bannerClass`, `BANNER_ICON`, `gaugeTone`, `gaugeGeom`, `nextPollDelay`,
  `makePollEpochGuard`, `runPollTick`, `POLL_JITTER_RATIO`, `POLL_BACKOFF_CAP_MS`.

## Styles

This package ships **no stylesheet**. Serve `@mythicalos/ui-core/styles.css` (after
`@mythicalos/tokens`) — it carries every class this package's components emit, including the 7 new
atoms (`.my-chip`, `.my-status`, `.my-card`, `.my-avatar`, `.my-search`, `.my-banner`, `.my-gauge`).

## Provenance

Version 0.2.0 marks the public release as the successor of the internal v0.1.0 surface
(same components and props; derivation moved into `@mythicalos/ui-core`). Ports the internal `@mythicalos/preact-ui` v0.1.0 (the frozen production component surface,
still consumed by skuld + brokkr) plus the 7 atoms design-export's workspace carried as "proposed
additions" (Chip, Card, Avatar, StatusLine, SearchInput, Banner, Gauge). All class/behavior
derivation that used to live inline in those source files now lives in `@mythicalos/ui-core`.

## License

Apache-2.0.
