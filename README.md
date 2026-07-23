# mythical-ui

The **mythicalOS component library** — the layer above `@mythicalos/tokens`.
Built so a React ASGARD and the Preact family apps share the same components.

> Four published packages, one layered system: a framework-agnostic core, thin
> Preact and React bindings that provably render identical output, and the Preact
> family shell.

## Packages

| Package | What it is |
|---|---|
| `@mythicalos/ui-core` | Framework-agnostic core: pure logic (class derivation, poll math, dialog/toast helpers), the component CSS, and the `<mythical-select>` web component. No Preact/React runtime. |
| `@mythicalos/preact-ui` | Thin **Preact** bindings over the core. |
| `@mythicalos/react-ui` | Thin **React** bindings over the core. |
| `@mythicalos/shell` | The **Preact family shell**: `ProductSwitcher`, `TopBar`, `NavTabs`, `WorkspaceSplit`, `SettingsLayout`, `useTheme`, and the family registry. |

## Design principles

- **Agnostic core + thin per-framework bindings** — the shared value (logic +
  tokens/CSS) is framework-neutral; each binding is a small render wrapper. No
  `preact/compat` runtime.
- **Tokens only** — every visual is a class from `@mythicalos/tokens`; no
  hard-coded color/size/radius, no inline `style=` (strict CSP).
- **Honesty discipline** — degraded / unavailable / loading states are
  first-class.

## License

Apache-2.0.
