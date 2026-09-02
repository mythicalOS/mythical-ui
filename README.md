<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img src=".github/assets/logo-light.svg" alt="mythicalOS" width="84" height="84">
  </picture>
</p>

<h1 align="center">mythical-ui</h1>

<p align="center">
  <strong>The mythicalOS component library — one agnostic core, thin Preact and React bindings that render identical output.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="License: Apache-2.0"></a>
  <a href="https://www.npmjs.com/package/@mythicalos/ui-core"><img src="https://img.shields.io/npm/v/@mythicalos/ui-core.svg?logo=npm&color=cb3837&label=ui-core" alt="npm: @mythicalos/ui-core"></a>
  <img src="https://img.shields.io/badge/TypeScript-3178c6.svg?logo=typescript&logoColor=white" alt="TypeScript">
  <a href="https://mythicalos.ai"><img src="https://img.shields.io/badge/part_of-mythicalOS-0F6B66.svg" alt="Part of mythicalOS"></a>
</p>

---

The layer above [`@mythicalos/tokens`](https://github.com/mythicalOS/mythical-design): pure logic
and component CSS in a framework-neutral core, with per-framework bindings so a React app and the
Preact family apps share the same components.

## Packages

| Package | What it is |
|---------|------------|
| [`@mythicalos/ui-core`](https://www.npmjs.com/package/@mythicalos/ui-core) | Framework-agnostic core — class derivation, poll/dialog/toast logic, component CSS, and the `<mythical-select>` web component. No Preact/React runtime. |
| [`@mythicalos/preact-ui`](https://www.npmjs.com/package/@mythicalos/preact-ui) | Thin **Preact** bindings over the core. |
| [`@mythicalos/react-ui`](https://www.npmjs.com/package/@mythicalos/react-ui) | Thin **React** bindings over the core. |
| [`@mythicalos/shell`](https://www.npmjs.com/package/@mythicalos/shell) | The Preact family shell — `ProductSwitcher`, `TopBar`, `NavTabs`, `WorkspaceSplit`, `SettingsLayout`, `useTheme`, and the family registry. |

## Principles

- **Agnostic core, thin bindings** — the shared value (logic + tokens/CSS) is framework-neutral;
  each binding is a small render wrapper. No `preact/compat`.
- **Tokens only** — every visual is a class from `@mythicalos/tokens`. No hard-coded colour, size,
  or radius; no inline `style=` (strict CSP).
- **Honest states** — degraded, unavailable, and loading are first-class, not afterthoughts.

## Develop

```sh
bun install
bun run build   # · bun test · bun run typecheck
```

Preview cards and drift control live under `previews/` — see [`previews/README.md`](previews/README.md).

## License

**Apache-2.0** — see [LICENSE](LICENSE) and [NOTICE](NOTICE); the licence covers the code, not the
mythicalOS name and marks ([TRADEMARK.md](TRADEMARK.md)). All four packages are open and stay open —
none is a reduced build, and nothing is held back for the separate, private paid tier. Contributions
welcome under a DCO sign-off, no CLA — see [CONTRIBUTING.md](CONTRIBUTING.md).
