# @mythicalos/ui-core

The **framework-agnostic core** of the mythicalOS component library — pure logic; no framework
runtime. It holds the branchy, DOM-free logic that both the Preact and React bindings import, so
the two frameworks derive identical classes/behavior from one source: button class derivation, the
U7 poll-scheduling math + fire-time epoch guard, the confirm-dialog typed-name gate, the toast
text-composition helper, and the circular-gauge geometry.

This package MUST NOT import `preact` or `react` — see `test/agnostic.test.ts`.

## Usage

```ts
import { buttonClass, nextPollDelay, typedNameMatches } from "@mythicalos/ui-core/logic";
```

## License

Apache-2.0.
