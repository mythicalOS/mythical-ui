# AGENTS.md — mythical-ui

The **mythicalOS component library** — the layer above `@mythicalos/tokens`. Four published
packages under `packages/`: `@mythicalos/ui-core` (framework-agnostic logic + component CSS +
the `<mythical-select>` web component), `@mythicalos/preact-ui` and `@mythicalos/react-ui`
(thin bindings that provably render identical output), and `@mythicalos/shell` (the Preact
family shell). A Bun workspace.

## Authority & precedence

Repository orientation, not a role contract. If a role, playbook, or system prompt governs your
session, that contract is authoritative and supersedes anything here — including the commands.
This file grants no edit, run, commit, push, publish, or release permission.

## Commands

Run only if your active role permits command execution.

- Install: `bun install`
- Root: `bun run build` · `bun test` · `bun run typecheck`
- Preview cards: `previews/scripts/check-ds.sh` (drift control; `--fix` re-embeds the mechanical
  parts) · `previews/scripts/generate-preview.sh` · `previews/scripts/subset-ds-fonts.sh`
  (needs fontTools + brotli — see the script header; `check-ds.sh` is stdlib-only and cannot
  substitute for a real regeneration run)

The previews tooling resolves tokens and fonts from a **sibling `mythical-design` checkout**;
CI clones one for the `hygiene` job. Report skipped or failing checks exactly.

## Boundaries & gotchas

- **`@dsInline` / `@dsFonts` blocks in `previews/ds/` cards are TOOL-OWNED** — byte-compared
  against `packages/ui-core/src/...` canonical sources by `check-ds.sh`. Never hand-edit inside
  one, even to fix wording: change the canonical source and run `check-ds.sh --fix`, or CI's
  `hygiene` job goes red.
- **`previews/ds/` is NOT the claude.ai Design-pane source** — that lives in the tokens repo's
  own `ds/` set. The two sets overlap but can never be identical (their `@dsInline` markers name
  different canonical paths). Never copy cards between the repos, and never delete either set as
  a duplicate; shared-card content edits are applied in both, by hand, in the same wording.
- **Tokens only, no inline styles** (strict CSP downstream): every visual is a class from
  `@mythicalos/tokens`; dynamic visuals ride classes or SVG presentation attributes, never
  `style=`.
- **`main` forbids merge commits** — rebase your branch; a merge commit is rejected.
- **Publishing is a release action**: a `v*` git tag drives `.github/workflows/release.yml`
  (npm trusted publishing). Never `npm publish` locally, and never push a `v*` tag without
  explicit release authority.
- CI runs a `docs-bar` content gate on this public repository — keep all content and commit
  messages free of internal project vocabulary.
- This repo is consumed as a pinned submodule by a private downstream workspace: land and push
  on `main` here first, then the consumer bumps its pin.
