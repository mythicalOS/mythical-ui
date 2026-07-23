#!/usr/bin/env bash
# generate-preview.sh — build previews/preview.html from preview.src.html.
#
#   ./scripts/generate-preview.sh
#
# What it does:
#   1. Inlines tokens.css into the template (replacing the <link>), embedding the
#      woff2 fonts tokens.css references as data: URIs — the output renders as a
#      single self-contained file anywhere (iPad Files/QuickLook, mail, no server).
#      tokens.css + its fonts live in the SIBLING mythical-design checkout (Task 9
#      repoint) — the same sibling-checkout resolution packages/ui-core/test/css.test.ts
#      relies on for its filesystem read of tokens.css. Requires a checkout of
#      mythical-design as a sibling of this repo (../../mythical-design from here).
#   2. Stamps the generation date, every inlined source (preview.src.html,
#      tokens.css, and any inlined component scripts) and this repo's git hash
#      as an HTML comment at the top (with a dirty marker if any of those
#      inputs — including the exact woff2 files tokens.css references — have
#      uncommitted changes at generation time, in EITHER this repo or the sibling
#      mythical-design checkout; fonts are checked but never listed as stamp
#      sources).
#   3. Archives the previous preview.html as
#      preview.<YYYYMMDD>-<shortsha>[-N].html — date and sha parsed from its
#      own generation stamp (falling back to file mtime / a date-only name when
#      absent) — before replacing it, so archives are per build, not per day.
#      The -N suffix appears only on a name collision with DIFFERENT content
#      (-2, -3, …; identical content is reused). No-op if the build output is
#      identical to the current preview.html.
#
# Edit preview.src.html, never preview.html.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - <<'PY'
import base64, datetime, pathlib, re, subprocess

d = pathlib.Path('.')
# sibling checkout (Task 9 repoint): tokens.css + the fonts it references no
# longer live alongside this template — they're the canonical mythical-design
# repo, checked out next to this one ({mythical-ui,mythical-design}).
DESIGN_ROOT = d / '..' / '..' / 'mythical-design'
src = (d / 'preview.src.html').read_text()
css = (DESIGN_ROOT / 'tokens.css').read_text()

# --- inline the fonts tokens.css references (skip missing files gracefully) ---
FONT_RE = r'url\("(assets/fonts/[^"]+\.woff2)"\)\s*format\("woff2"\)'
# the exact font paths tokens.css references — these (and only these) join the
# dirty check below: a touched license or stray file in assets/fonts is NOT an
# inlined input and must not mark the build dirty
fonts = re.findall(FONT_RE, css)
inlined_fonts = []
def font_repl(m):
    p = DESIGN_ROOT / m.group(1)
    if not p.exists():
        return m.group(0)
    b64 = base64.b64encode(p.read_bytes()).decode()
    inlined_fonts.append(f'{p.name} ({p.stat().st_size // 1024} KB)')
    return f'url("data:font/woff2;base64,{b64}") format("woff2")'
css = re.sub(FONT_RE, font_repl, css)

# --- build ---
out = re.sub(r'<!-- =+\n     SOURCE TEMPLATE.*?=+ -->\n', '', src, flags=re.S)
TOKENS_LINK = '<link rel="stylesheet" href="../../mythical-design/tokens.css">'
assert TOKENS_LINK in out, 'template lost its tokens.css <link>'
out = out.replace(
    TOKENS_LINK,
    '<style>\n/* tokens.css — inlined at generation; fonts embedded as data: URIs.\n'
    '   Canonical source: the sibling mythical-design/tokens.css — regenerate, never edit here. */\n'
    + css + '\n</style>', 1)

# --- inline local component scripts (e.g. mythical-select.js) ---
inlined_js = []
def js_repl(m):
    ref = m.group(1)
    p = d / ref
    if not p.exists():
        return m.group(0)
    inlined_js.append(p.name)
    canonical = re.sub(r'^(\.\./)+', '', ref)  # display path, leading ../ stripped
    return ('<script>\n/* ' + p.name + ' — inlined at generation; canonical source: '
            + canonical + ' */\n' + p.read_text() + '\n</script>')
out = re.sub(r'<script src="([A-Za-z0-9./_-]+\.js)"></script>', js_repl, out)

# --- provenance (stamp names every inlined source) ---
def git(*a, cwd=None):
    return subprocess.run(['git', *a], capture_output=True, text=True, cwd=cwd).stdout.strip()
sha = git('rev-parse', '--short', 'HEAD')  # this repo (mythical-ui) — preview.html lives here
# preview.src.html + inlined component scripts are THIS repo's inputs; tokens.css
# + the fonts it references are the SIBLING mythical-design checkout's inputs —
# a git pathspec can't cross a repo boundary, so each repo is checked separately.
dirty_here = git('status', '--porcelain', '--', 'preview.src.html', *inlined_js)
dirty_design = git('status', '--porcelain', '--', 'tokens.css', *fonts, cwd=str(DESIGN_ROOT))
dirty = dirty_here or dirty_design
today = datetime.date.today()
sources = ' + '.join(['preview.src.html', 'tokens.css', *inlined_js])
stamp = (f'<!-- GENERATED {today.isoformat()} from {sources} '
         f'@ git {sha}{" (+UNCOMMITTED input changes)" if dirty else ""} '
         f'— DO NOT EDIT; edit preview.src.html and run ./scripts/generate-preview.sh -->')
out = out.replace('<!doctype html>', '<!doctype html>\n' + stamp, 1)

# --- archive previous, write new ---
prev = d / 'preview.html'
if prev.exists():
    old = prev.read_text()
    if old == out:
        print(f'preview.html already up to date (git {sha}) — nothing written.')
        raise SystemExit(0)
    m = re.search(r'<!-- GENERATED (\d{4})-(\d{2})-(\d{2})', old)
    tag = ''.join(m.groups()) if m else datetime.date.fromtimestamp(prev.stat().st_mtime).strftime('%Y%m%d')
    oldsha = re.search(r'@ git ([0-9a-fA-F]+)', old)  # per-build archives; date-only when absent
    if oldsha:
        tag += f'-{oldsha.group(1)}'
    # collision-safe: same tag + DIFFERENT content appends -2, -3, … until free;
    # an archive with identical content is silently reused.
    archive = d / f'preview.{tag}.html'
    n = 1
    while archive.exists() and archive.read_text() != old:
        n += 1
        archive = d / f'preview.{tag}-{n}.html'
    if archive.exists():
        print(f'archive already current -> {archive.name}')
    else:
        archive.write_text(old)
        print(f'archived previous -> {archive.name}')
prev.write_text(out)
print(f'wrote preview.html @ git {sha}{" (+dirty inputs)" if dirty else ""} '
      f'({len(out) // 1024} KB; fonts inlined: {", ".join(inlined_fonts) or "none"}; '
      f'scripts inlined: {", ".join(inlined_js) or "none"})')
PY
