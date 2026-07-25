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

## Licence and the paid tier

**Apache-2.0** — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

All four packages are open and stay open. They are not reduced builds of paid
ones, and no component is held back for a commercial tier. mythicalOS does sell a
hosted, multi-user tier — that is separate, private software, and it consumes
these packages on exactly the terms you do.

Apache-2.0 lets you use, modify, redistribute, and build commercial products on
these packages — including products that compete with ours — provided you keep
the licence and attribution notices intact. Contributions are accepted under the
same licence with a [DCO](https://developercertificate.org/) sign-off and **no
CLA** (see [`CONTRIBUTING.md`](CONTRIBUTING.md)): we take no copyright assignment
and no relicensing right, so this project cannot be moved off Apache-2.0 without
every contributor's agreement, and anything already released under it stays
available under it.
