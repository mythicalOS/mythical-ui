# CLAUDE.md

Read `AGENTS.md` first — it is the harness-neutral source of truth and does not override your
active role contract. The import below loads it for Claude Code.

@AGENTS.md

Claude-specific notes:

- `previews/preview.html` is generated (≈MBs, embedded fonts) — never open it whole or edit it;
  edit `preview.src.html` / the cards and regenerate.
- After touching any `previews/ds/` card or `packages/ui-core` source it embeds, run
  `previews/scripts/check-ds.sh` before claiming the change is done.
