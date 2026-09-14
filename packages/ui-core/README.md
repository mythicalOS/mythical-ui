# @mythicalos/ui-core

The **framework-agnostic core** of the mythicalOS component library — pure logic; no framework
runtime. It holds the branchy, DOM-free logic that both the Preact and React bindings import, so
the two frameworks derive identical classes/behavior from one source: button class derivation, the
poll-scheduling math + fire-time epoch guard, the confirm-dialog typed-name gate, the toast
text composition, dismiss policy and stack state, and the circular-gauge geometry.

This package MUST NOT import `preact` or `react` — see `test/agnostic.test.ts`.

## Install / Import

```sh
npm add @mythicalos/ui-core
```

`@mythicalos/tokens` is a peer dependency — load its stylesheet *before* this
package's so the `--my-*` custom properties it defines are already in scope
when `styles.css` resolves through them:

```sh
npm add @mythicalos/tokens
```

Three import forms, all consumable from a plain Node ESM script, a webpack/vite
app, or a React/Preact bundle — `./logic` ships compiled ESM + `.d.ts` from
`dist/` (not raw TypeScript source), so no consumer needs a TS loader for it:

```ts
// 1. logic — pure functions/types, zero DOM, zero framework runtime
import { buttonClass, nextPollDelay, typedNameMatches } from "@mythicalos/ui-core/logic";
// (equivalently, the package root re-exports the same thing)
import { buttonClass } from "@mythicalos/ui-core";

// 2. styles — the atom-class stylesheet; import @mythicalos/tokens' CSS first
import "@mythicalos/tokens";
import "@mythicalos/ui-core/styles.css";

// 3. the <mythical-select> web component — a registration side effect
import "@mythicalos/ui-core/select";
```

## Usage

```ts
import { buttonClass, nextPollDelay, typedNameMatches } from "@mythicalos/ui-core/logic";
```

## Styles

`./styles.css` is the component stylesheet — the atom classes the logic above derives (buttons,
chips, status lines, banners, gauges, inputs/toggles/checkboxes, toasts, dialogs, empty states).
Serve it AFTER `@mythicalos/tokens`' stylesheet; every value resolves through a `--my-*` custom
property.

```ts
import "@mythicalos/ui-core/styles.css";
```

## Toasts — the dismiss policy

`TOAST_DISMISS_MS` is the auto-dismiss cadence every binding shares: `ok` 2600 ms, `info` 4000 ms,
`warn` 8000 ms, and `error` `null` — **`null` means no deadline at all**: an error stays until the
operator closes it. A failure is the message most worth reading, so it is not timed out from under
the reader; `null` is deliberately not `0`, which would dismiss on the next tick.

`createToastStack()` is that policy as state — the toast list, one deadline per toast, the
hover/focus hold (`setHold(reason, held)`, which freezes each remaining time and re-arms it with
exactly that remainder — the pointer and the keyboard are separate reasons, and the stack resumes
only when the last one is released), and the collapse (`toastStackView`: the newest `TOAST_MAX_VISIBLE` render, the rest are
counted and reachable by expanding). It takes an injectable clock, so the behavior is testable
without a DOM and without waiting real seconds. The bindings render `view()` and call back in; they
own no timer of their own.

```ts
import { createToastStack, TOAST_DISMISS_MS } from "@mythicalos/ui-core/logic";
```

## `<mythical-select>`

A form-associated, native-parity `<select>` web component — vanilla custom elements
(`<mythical-select>`, `<mythical-option>`, `<mythical-optgroup>`), no framework
runtime, which is why it lives in core rather than in a Preact/React binding.
Import it once (a registration side effect) to define the elements:

```ts
import "@mythicalos/ui-core/select";
```

TypeScript consumers get the element's ambient DOM typings (`MythicalSelectElement`,
`HTMLElementTagNameMap` augmentation, …) via the same import path's `types` condition.

The component ships a 354-test cross-engine Playwright parity suite (Chromium,
Firefox, WebKit) covering the ARIA tree, selection/keyboard/typeahead, forms and
validity, the wrapped-native contract, a strict-CSP fixture, and the
no-`ElementInternals` fallback. Run it with:

```sh
bun run test:select
```

This is separate from `bun test` (the unit suite) on purpose — Playwright's `test`/
`expect` are not bun:test's, and `test/select/**` is excluded from bun's own test
discovery (see `bunfig.toml`).

## License

Apache-2.0.
