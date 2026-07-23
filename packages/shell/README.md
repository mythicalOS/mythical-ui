# @mythicalos/shell

The mythicalOS **Preact-only FAMILY SHELL** — the central, cross-product modules that must be
identical across every product (BROKKR / SKULD / SAGA / EDDA). Its reason to exist is the
**product selector**; it also owns the top bar, nav, the list+detail workspace, and the settings
layout. Apache-2.0.

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

The one component that makes four products feel like one. The logo *is* the trigger; clicking it
opens the family panel from the shared registry (`PRODUCTS`, in `src/products.ts`).

```jsx
<ProductSwitcher
  current="brokkr"                              // → "here" badge
  onNavigate={(p) => location.assign(p.href)}    // wire to hash routing
  onUnbuilt={(p) => toast(`${p.name} isn't built yet.`)}
/>
```

Adding a product to the whole family is **one entry** in `PRODUCTS`. ASGARD is intentionally held
out and shown as a footer note (`FAMILY_NOTE`) until it ships.

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
| `Logo`, `LogoMark` | the mythical mark + two-line wordmark |
| `TopBar`, `TopBar.Right` | 56px sticky top-bar shell |
| `NavTabs` | primary nav pills (accent-soft active) |
| `WorkspaceSplit` + `RailHead`/`RailList`/`RailGroup`/`RailCard` | the 320px rail + detail pattern |
| `SettingsLayout`, `SettingsNav` | 260px settings nav + detail |
| `PRODUCTS`, `FAMILY_NOTE` | the shared family registry |
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

Ports design-export's `mythical-ui` v0.1.0 (JSX → typed TSX), the repo the design-export README
describes as "the layer you asked to create as a new, future-OSS repository." Content (the family
registry, class names, behavior) is kept faithful to that export; `useTheme`'s `storageKey` option
is the one deliberate addition, added so existing installs (BROKKR) don't lose a user's theme
choice.

## License

Apache-2.0.

The stylesheet also ships a small `.my-statusline` utility row (dot + text)
with no dedicated component — pair it with the atoms' `statusLineClass` tones.
