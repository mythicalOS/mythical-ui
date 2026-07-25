# @mythicalos/shell

The mythicalOS **Preact-only FAMILY SHELL** — the central, cross-product modules that must be
identical across every product (BROKKR / SKULD / SAGA). Its reason to exist is the **product
selector**; it also owns the top bar, nav, the list+detail workspace, and the settings layout.
Apache-2.0.

A future React product (**asgard**) gets its **own React shell** later — this package is
deliberately Preact-only; no React, no `preact/compat`.

## Where it sits (three layers)

```
@mythicalos/tokens          tokens + CSS + fonts            (look)
        ▲
@mythicalos/preact-ui       Button, Input, Toggle, Toast,   (atoms)
        ▲                   ConfirmDialog, Chip, Card, …
@mythicalos/shell  ← here   ProductSwitcher, TopBar, NavTabs, WorkspaceSplit,
                            SettingsLayout, family registry, useTheme  (family shell)
        ▲
   a product (brokkr, skuld, …)                              (composition)
```

`@mythicalos/shell` depends on `@mythicalos/preact-ui` (atoms), which in turn depends on
`@mythicalos/ui-core`. It never redefines an atom that already exists upstream — it composes them
into family furniture.

## Install

```sh
npm add @mythicalos/shell @mythicalos/preact-ui preact
```

## Import — serve the three layers, in order

```js
import "@mythicalos/tokens/tokens.css";       // 1. tokens
import "@mythicalos/ui-core/styles.css";      // 2. atom classes (Button, Chip, Card, …)
import "@mythicalos/shell/styles.css";        // 3. shell classes (topbar, switcher, nav, …)

import {
  ProductSwitcher, TopBar, NavTabs,
  WorkspaceSplit, RailHead, RailList, RailGroup, RailCard,
  SettingsLayout, SettingsNav, useTheme,
} from "@mythicalos/shell";
import { Button, Toast, ConfirmDialog } from "@mythicalos/preact-ui";
```

## The product selector (flagship)

The one component that makes the products feel like one. The logo *is* the trigger; clicking it
opens the family panel from the shared registry (`PRODUCTS`, in `src/products.ts`), followed by a
**command center** section holding `ASGARD`.

```jsx
<ProductSwitcher
  current="brokkr"                              // → "here" badge + the logo's mark
  onNavigate={(p) => location.assign(p.href)}    // wire to hash routing
  onUnbuilt={(p) => toast(`${p.name} isn't built yet.`)}
/>
```

Adding a product to the whole family is **one entry** in `PRODUCTS`.

Three behaviors worth knowing:

- **The mark is the product you are in.** `Logo` renders `current`'s product glyph — the same
  rule in every logo slot (top bar, auth screen, wizard header). A key with no registered glyph
  art falls back to the generic family mark (`LogoMark`), so the slot is never empty.
- **The current row's role line gets a `· this container` suffix**, derived from `current` at
  render time. Registry roles stay context-free, so the suffix is never false in another
  product's menu.
- **`ASGARD` is not in `PRODUCTS`** — it renders in its own command-center section. It is not
  built, so it deliberately ships the *not-yet-built* dot and routes clicks to `onUnbuilt`
  instead of navigating. This package never renders a state it has not proven.

`PRODUCTS` hrefs are **placeholders** (`/brokkr`, `/skuld`, `/saga`). A product that knows where
its siblings actually live should resolve the real target in `onNavigate` and ignore `href`.

## useTheme — storageKey

`useTheme` persists the light/dark choice to `localStorage` and reflects it onto
`<html data-theme="…">`, which every token in `@mythicalos/tokens` reacts to. A fresh consumer
needs nothing extra:

```jsx
const { theme, setTheme, toggle } = useTheme(); // localStorage key: "mythical:theme"
```

Pass `storageKey` if your product already persists its theme choice under a different key, so
installing this package doesn't reset every existing user back to the default:

```jsx
// BROKKR's pre-existing key — installing @mythicalos/shell must not lose anyone's theme.
const { theme, toggle } = useTheme("light", { storageKey: "mythical.ui.theme" });
```

## Exports

| Export | Purpose |
|---|---|
| `ProductSwitcher` | the family product selector |
| `Logo` | the current product's glyph + two-line wordmark |
| `LogoMark` | the generic family mark — `Logo`'s fallback for a key with no glyph art |
| `TopBar`, `TopBar.Right` | 56px sticky top-bar shell |
| `NavTabs` | primary nav pills (accent-soft active) |
| `WorkspaceSplit` + `RailHead`/`RailList`/`RailGroup`/`RailCard` | the 320px rail + detail pattern |
| `SettingsLayout`, `SettingsNav` | 260px settings nav + detail |
| `PRODUCTS`, `ASGARD` | the shared family registry + the command-center entry |
| `FAMILY_NOTE` | *deprecated* — the retired footer-note copy, still exported for compatibility |
| `useTheme` | light/heritage-dark; persists (configurable key) + sets `<html data-theme>` |

Generic components (`Chip`, `Card`, `Avatar`, `StatusLine`, `SearchInput`, `Banner`, `Gauge`, …)
live in `@mythicalos/preact-ui` — import them from there, not here. `@mythicalos/shell` only owns
the family shell.

## Styles

`styles.css` ships only the SHELL class families (top bar, logo, product switcher, nav tabs, icon
button, overflow menu, workspace split/rail/rail-card, settings nav, app/page frame). The ATOM
families (button, input, chip, card, avatar, status, search, banner, gauge, toast, dialog, …) ship
from `@mythicalos/ui-core/styles.css` and are never duplicated here — see the stylesheet's own
top-of-file comment for the full token-fidelity/remap notes.

## Provenance

Ports the design source's `mythical-ui` v0.1.0 (JSX → typed TSX), described there as "the layer
you asked to create as a new, future-OSS repository." Content (the family registry, class names,
behavior) is kept faithful to it, with three deliberate departures:

- `useTheme`'s `storageKey` option, so an existing install doesn't lose a user's theme choice;
- the `· this container` suffix and the registry `state` values are **derived**, not copied — the
  design source is one product's page, so anything it states about "the product you're in" has to
  follow `current` here, and any state has to follow what actually ships;
- the command-center row copies the design source's *structure* but not its "online" dot or its
  navigation target, because ASGARD is not built (see above).

## License

Apache-2.0.

The stylesheet also ships a small `.my-statusline` utility row (dot + text)
with no dedicated component — pair it with the atoms' `statusLineClass` tones.
