# previews/

Component previews for **mythical-ui** — moved here from the mythical-design tokens repo
(Task 9) because they render this repo's components; the tokens repo now only owns
`tokens.css` + `design.md`.

## Contents

| Path | What it is |
|------|-----------|
| `preview.src.html` | The all-components preview page — **source template**. Links `../../mythical-design/tokens.css` and `../packages/ui-core/src/select/mythical-select.js` live, so it's viewable directly in a browser when checked out as a sibling of `mythical-design` (the same layout `packages/ui-core/test/css.test.ts` and the select Playwright suite already assume). **Edit this**, then run `./scripts/generate-preview.sh`. |
| `preview.html` | All components on one page — **GENERATED, self-contained** (tokens + fonts + the select component's JS inlined as data: URIs / literal script text; git-hash provenance stamp at the top). Viewable anywhere, including iPad Files/QuickLook or a mail attachment — no server, no sibling checkout needed. Never edit by hand. |
| `ds/` | Per-component preview cards for the claude.ai Design pane (**cards are synced from here now**, not from mythical-design) — self-contained HTML, first-line `@dsCard` marker, one card per `preview.src.html` section. Machine-checked by `scripts/check-ds.sh`; embedded component source (`@dsInline`, currently just `mythical-select.js`) and font subsets (`@dsFonts`) are tool-owned. |
| `scripts/generate-preview.sh` | Rebuilds `preview.html` from `preview.src.html`. Reads `tokens.css` (+ the woff2 fonts it references) from the **sibling `mythical-design` checkout** — requires `{mythical-ui,mythical-design}` side by side. Archives the previous build as `preview.<YYYYMMDD>-<shortsha>[-N].html`. |
| `scripts/check-ds.sh` | Executable drift control for `ds/` (python3 stdlib only — no fontTools). Validates `@dsCard` markers, self-containment, `--my-*` token identity against the sibling `mythical-design/tokens.css`, byte-exact `@dsInline` identity against `packages/ui-core/src/select/mythical-select.js`, and `@dsFonts` payload hashes + codepoint coverage against `assets/fonts/ds-subset/manifest.json`. `--fix` re-embeds the mechanical parts (never touches token/containment findings — those are human decisions). |
| `scripts/subset-ds-fonts.sh` | Regenerates the card font subsets in `assets/fonts/ds-subset/` (+ `manifest.json`) from the **sibling `mythical-design/assets/fonts/*.woff2`** canonical files and the characters the cards actually use. **Requires fontTools + brotli** (not stdlib) — see the venv one-liner in the script's header. Rerun only when coverage or the canonical fonts change, and always re-verify by actually running it after editing the script (`check-ds.sh`'s stdlib-only design means it cannot substitute for a real regeneration run). |
| `assets/fonts/ds-subset/` | Subset woff2s (+ `manifest.json`) embedded into every `ds/*.html` card's `@dsFonts` block. Derived artifacts — regenerate with `subset-ds-fonts.sh`, don't hand-edit. |

## Sibling-checkout requirement

`generate-preview.sh`, `check-ds.sh`, and `subset-ds-fonts.sh` all resolve tokens (and, for
the fonts scripts, the canonical source `.woff2` files) from a **sibling checkout** of
`mythical-design` — i.e. `mythical-design/` next to this repo's
`mythical-ui/`. This is the exact resolution
`packages/ui-core/test/css.test.ts` and `packages/ui-core/playwright.config.js` already
rely on, so local dev needs no extra setup beyond having both repos checked out normally.
In CI, a workflow step checks out `mythical-design` at a matching sibling path (see
`.github/workflows/ci.yml`, job `hygiene`) since there's no persistent sibling checkout
on a runner.

## Workflow

Design/component change → edit `preview.src.html` (and/or the upstream `tokens.css` in
`mythical-design`, or `packages/ui-core/src/select/mythical-select.js`) → run
`./scripts/generate-preview.sh` → commit the regenerated `preview.html` + archive → sync
the affected `ds/` card(s): hand-edit the design content, then `./scripts/check-ds.sh --fix`
for the mechanical parts (re-embeds the canonical select source into `@dsInline`,
refreshes the embedded `@dsFonts` subsets) → `./scripts/check-ds.sh` until clean → commit
→ re-sync the claude.ai Design pane from `previews/ds/*.html`.

## fontTools requirement

`check-ds.sh` (the check that runs in CI) is **python3 stdlib only** — it validates the
existing subsets/manifest but cannot regenerate them. `subset-ds-fonts.sh` (regeneration)
needs `fontTools>=4.60` + `brotli`, which are NOT installed by default and are NOT a CI
dependency. If a `ds/` card's text changes to use a character outside the current subset's
coverage, `check-ds.sh` will fail with the missing codepoint(s) — install fontTools locally
(venv one-liner in `subset-ds-fonts.sh`'s header) and rerun the subsetter, then
`check-ds.sh --fix`, before that change can land.
