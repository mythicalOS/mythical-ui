#!/usr/bin/env bash
# subset-ds-fonts.sh — (re)generate the ds/ card font subsets in assets/fonts/ds-subset/.
#
#   ./scripts/subset-ds-fonts.sh
#
# One-time / regeneration tool. Run it when a ds/ card starts using a character the
# current subsets don't cover (`./scripts/check-ds.sh` tells you), or when the canonical woff2
# files change. Requires a checkout of mythical-design as a sibling of this repo
# (../../mythical-design from here) — tokens.css and the canonical source .woff2
# fonts (assets/fonts/*.woff2) live there, not in this repo. Afterwards run
# `./scripts/check-ds.sh --fix` to re-embed the refreshed payloads into every
# card, and commit ds-subset/ together with the cards.
#
# What it does:
#   1. Collects every unicode codepoint that appears in ds/*.html RENDERABLE content:
#      tag text — including <style>/<script> data, since the select component script
#      injects glyphs into the DOM, but COMMENT-STRIPPED (JS /* */ and // comments
#      outside string/template literals, CSS /* */ comments: comments never render;
#      string/template literal text stays collected) — plus RENDERED attribute values only (title, alt,
#      aria-label, aria-valuetext, placeholder, value, label; entities decoded, HTML
#      comments excluded; non-rendered attributes like data-*, id, class, href/src and
#      the rest of aria-* never reach a glyph). Then unions a STABILITY FLOOR so
#      ordinary copy edits never force a regeneration: ASCII printable U+0020–007E,
#      Latin-1 supplement U+00A0–00FF, general punctuation U+2000–206F, and the design
#      system's glyph symbols (✓ ✕ ✎ ⚠ ● ◐ ◑ ◇ ◈ ◉ ⬤ ▲ ▸ ▾ ▍ ⌘ ⎇ ⇧ ⏎ ℹ ← ↑ → ↓ − ∞ ≤ ≥ ⋯ 🔒).
#      KNOWN LIMIT (accepted, documented in check-ds.sh too): glyphs produced
#      dynamically at runtime (String.fromCodePoint etc.) cannot be statically
#      collected — the stability floor covers realistic cases; authors adding exotic
#      dynamic glyphs must rerun this subsetter.
#   2. Subsets assets/fonts/InterVariable.woff2 (weight axis KEPT — default pyftsubset
#      axis retention, no instancing) and JetBrainsMono-{Regular,Medium,Bold}.woff2 to
#      assets/fonts/ds-subset/{same names}.woff2, --flavor=woff2, all layout features
#      retained (tnum matters: rule 5, tabular-nums on counters). Italic faces are
#      deliberately NOT subset — no ds/ card uses italics (check-ds.sh fails any
#      font-style:italic request).
#      FALLBACK: if the variable Inter subset pushes the total payload over the budget
#      (variable tables can subset poorly), the script instead instances Inter at the
#      weights the cards' CSS actually requests (derived by the same font-request scan
#      check-ds.sh runs — NOT hardcoded; CSS-correct: numeric weights 1–1000 with
#      fractional kept exact, `font:` shorthand without a weight = 400, !important
#      stripped, card-local var() resolution, <b>/<strong>/<h1>–<h6>/<th> = UA-bold
#      700) via fontTools.varLib.instancer into static subsets (Inter-w<N>.woff2 —
#      decimals encoded as `_`, e.g. 650.5 -> Inter-w650_5.woff2) and records
#      mode="instanced" in the manifest. Requests OUTSIDE the source wght axis are
#      REJECTED with the offending card named — never clamped/mislabeled.
#   3. Writes assets/fonts/ds-subset/manifest.json: per-file sha256 + byte size +
#      @font-face metadata (family/weight/style — check-ds.sh --fix builds the cards'
#      @dsFonts block from this, stdlib-only; the variable Inter face also records its
#      wght axis range as `wghtAxis` — check-ds.sh validates requested weights against
#      it), the sha256 of every SOURCE font that was subsetted (`sources` — check-ds.sh
#      flags "canonical fonts changed" when assets/fonts/ drifts from these), the
#      sorted codepoint list the subsets are built to cover (the coverage CONTRACT
#      ./scripts/check-ds.sh validates cards against), the card-CSS-derived requested weights
#      (`requestedWeights`, diagnostic), and per-file lists of requested codepoints the
#      source font simply does not have (e.g. emoji — those fall through to system
#      fonts, same as with the full canonical font). check-ds.sh treats the manifest
#      as the sole authority over ds-subset/: files not recorded there are violations.
#
# REQUIRES fontTools (with woff2/brotli support) — unlike check-ds.sh, which is
# python3-stdlib-only and is the only script the repo depends on at check time.
# One-liner to get a throwaway environment:
#
#   python3 -m venv /tmp/ftvenv && /tmp/ftvenv/bin/pip install 'fonttools>=4.60' brotli \
#     && PYTHON=/tmp/ftvenv/bin/python ./scripts/subset-ds-fonts.sh
#
# PYTHON env var overrides the interpreter (must have fontTools + brotli importable).
set -euo pipefail
cd "$(dirname "$0")/.."

PYTHON="${PYTHON:-python3}"
"$PYTHON" -c 'import fontTools, brotli' 2>/dev/null || {
  echo "error: $PYTHON lacks fontTools/brotli — see the venv one-liner in this script's header" >&2
  exit 2
}

"$PYTHON" - <<'PY'
import datetime, hashlib, html.parser, io, json, pathlib, re, sys
from fontTools.subset import Options, Subsetter, load_font, save_font
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

d = pathlib.Path('.')
OUT = d / 'assets' / 'fonts' / 'ds-subset'
# sibling checkout (Task 9 repoint): tokens.css + the canonical source .woff2
# files it's subset from live in the sibling mythical-design checkout — the
# same sibling-checkout resolution packages/ui-core/test/css.test.ts relies on.
DESIGN_ROOT = d / '..' / '..' / 'mythical-design'
BUDGET = 220 * 1024  # total payload target: comfortably under ~250 KB

# --- 1. collect codepoints + CSS font requests from the cards --------------------
# NOTE: extraction + request-scan logic mirrored in check-ds.sh — keep in sync.
RENDERED_ATTRS = {'title', 'alt', 'aria-label', 'aria-valuetext',
                  'placeholder', 'value', 'label'}

class TextCollector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.chunks = []
        self.styles = []
        self.inline_styles = []
        self.bold_markup = False
        self._in_style = False
        self._in_script = False
        self._script_buf = []    # script SOURCE — comment-stripped at flush
        self._style_buf = []     # style SOURCE — CSS-comment-stripped at flush
    def handle_data(self, data):
        # <script>/<style> SOURCE is buffered and flushed to `chunks` with its
        # comments stripped at the end tag (comments never render; string /
        # template literal text stays collected — see strip_js_comments).
        # Buffering keeps multi-chunk CDATA deliveries whole so a comment can
        # never straddle a chunk boundary.
        if self._in_script:
            self._script_buf.append(data)
            return
        if self._in_style:
            self.styles.append(data)      # raw CSS for the rule parsers
            self._style_buf.append(data)
            return
        self.chunks.append(data)
    def _flush_source_text(self):
        if self._script_buf:
            self.chunks.append(strip_js_comments(''.join(self._script_buf)))
            self._script_buf = []
        if self._style_buf:
            self.chunks.append(strip_css_comments(''.join(self._style_buf)))
            self._style_buf = []
    def handle_starttag(self, tag, attrs, selfclosing=False):
        self.chunks.extend(v for k, v in attrs
                           if v and k.lower() in RENDERED_ATTRS)
        amap = {k.lower(): (v or '') for k, v in attrs}
        if tag == 'style' and not selfclosing:
            self._in_style = True
        if tag == 'script' and not selfclosing:
            self._in_script = True
        if 'style' in amap:
            self.inline_styles.append(amap['style'])
        if tag in ('b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th'):
            self.bold_markup = True   # UA default font-weight:700 (conservative)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs, selfclosing=True)
    def handle_endtag(self, tag):
        if tag == 'style':
            self._in_style = False
            self._flush_source_text()
        if tag == 'script':
            self._in_script = False
            self._flush_source_text()
    def close(self):
        super().close()
        self._flush_source_text()   # unclosed <script>/<style> at EOF

def css_tokens(css):
    """Escape-aware CSS lexer — shared by strip_css_comments (gate r5 U1) and,
    in check-ds.sh, the var() reference scan (gate r5 U4). Yields (kind, text)
    with kind in {'code', 'string', 'comment'}: strings are single/double-
    quoted runs with backslash escapes honored (an escaped quote never ends a
    string, and a /* inside a string is TEXT — `content:"/* 漢 */"` RENDERS
    that text); comments are /* … */ runs OUTSIDE strings. In CODE context a
    backslash consumes the following character as a CSS escape BEFORE the
    quote/comment tests (gate r6 V1: `foo\\"bar` is an identifier carrying an
    escaped quote, not a string opener — an escape-shifted string state would
    both hide real var() references from the reference scan and mis-strip
    later RENDERED string text as a comment). An unterminated
    string or comment runs to EOF as its own token (the stripper KEEPS
    unterminated strings — lexing uncertainty errs toward keeping text).
    NOTE: mirrored byte-for-byte in the sibling collector script — the
    manifest codepoint contract requires both to derive the same set."""
    i, n = 0, len(css)
    buf = []
    while i < n:
        c = css[i]
        if c == '\\' and i + 1 < n:
            buf.append(c)                  # CSS escape in CODE context — the
            buf.append(css[i + 1])         # escaped char can never open a
            i += 2                         # string or comment (gate r6 V1)
            continue
        if c in '"\'':
            if buf:
                yield ('code', ''.join(buf))
                buf = []
            j, s = i + 1, [c]
            while j < n:
                cj = css[j]
                s.append(cj)
                if cj == '\\' and j + 1 < n:
                    s.append(css[j + 1])
                    j += 2
                    continue
                j += 1
                if cj == c:
                    break
            yield ('string', ''.join(s))
            i = j
            continue
        if c == '/' and i + 1 < n and css[i + 1] == '*':
            if buf:
                yield ('code', ''.join(buf))
                buf = []
            j = css.find('*/', i + 2)
            end = n if j < 0 else j + 2
            yield ('comment', css[i:end])
            i = end
            continue
        buf.append(c)
        i += 1
    if buf:
        yield ('code', ''.join(buf))

def strip_css_comments(css):
    """Remove CSS /* … */ comments — OUTSIDE single/double-quoted strings
    only, escapes honored (gate r5 U1: a comment-shaped run inside a string
    is RENDERED text, e.g. content:"/* 漢 */", and must stay collected)."""
    return ''.join(' ' if k == 'comment' else t for k, t in css_tokens(css))

def strip_js_comments(js):
    """Remove JS comments (`/* … */` and `// …`) from script SOURCE before
    codepoint collection — comments never render, while string and template
    literal TEXT stays collected (the select component injects real glyphs
    from strings; that rationale is unchanged). Escape-aware lexer:
      - string literals ('…' / "…") are emitted verbatim, backslash escapes
        honored; closing one puts the lexer in EXPRESSION-ENDED state (below).
      - template literals nest via a context stack (gate r5 U2): a backtick
        pushes template TEXT (emitted verbatim, escapes honored); `${` pushes
        a code frame whose braces are counted so the MATCHING `}` returns to
        the enclosing template's text — nested templates inside
        interpolations parse correctly. Anything the stack cannot account for
        (unterminated template/string, stray `}`) is EMITTED, never dropped:
        lexing uncertainty errs toward collecting more, never toward
        stripping string text.
      - `/` disambiguation (gate r5 U3): `//` and `/*` in code context always
        open comments (JS has no empty regex literal — `a // b` comments).
        A single `/` is DIVISION when an EXPRESSION-ENDED flag is set — after
        identifier/number characters, `)`, `]`, `$`, `_`, a closing string
        quote, a closing template backtick or a regex literal — so
        `const n="6" / 2` divides and a following string like "file:///漢"
        is untouched text. In any other position a bare `/` opens a regex
        literal: emitted verbatim to its unescaped closing `/` (character
        classes honored, trailing flags consumed, a newline bails out —
        regex literals cannot span lines).
      - postfix `++` / `--` (gate r6 V2): a `+`/`-` whose immediately
        preceding non-space CODE character is the same operator char is a
        postfix increment/decrement and SETS expression-ended — `i++ / 2`
        divides (so `` `${i++ / 2} file:///漢` `` keeps its template text);
        a lone binary/unary `+`/`-` still clears the flag.
    DOCUMENTED approximations: a keyword-preceded regex (`return /re/`)
    parses as division, `}` does not set expression-ended (object-literal
    ends are rarer than block ends), and a spaced `a + +b` matches the
    postfix rule — in pathological code each can misjudge a comment
    boundary, which errs toward collecting MORE codepoints, never toward
    dropping rendered text a correct parse keeps.
    NOTE: mirrored byte-for-byte in the sibling collector script — the
    manifest codepoint contract requires both to derive the same set."""
    out = []
    i, n = 0, len(js)
    stack = []            # nesting: ['tpl'] template text / ['expr', depth] ${…}
    expr_end = False      # True right after a token that can END an expression
    prev_code = ''        # last non-space CODE character (for the ++/-- rule)
    while i < n:
        c = js[i]
        if stack and stack[-1][0] == 'tpl':
            out.append(c)                  # template TEXT — kept verbatim
            if c == '\\' and i + 1 < n:
                out.append(js[i + 1])
                i += 2
                continue
            if c == '`':
                stack.pop()                # template literal closed
                expr_end = True
                prev_code = '`'
                i += 1
                continue
            if c == '$' and i + 1 < n and js[i + 1] == '{':
                out.append('{')            # ${ — enter interpolation code
                stack.append(['expr', 0])
                expr_end = False
                prev_code = '{'
                i += 2
                continue
            i += 1
            continue
        # ---- code context (top level or inside a ${…} frame) ----
        if c in '"\'':
            out.append(c)                  # string literal — kept verbatim
            j = i + 1
            while j < n:
                cj = js[j]
                out.append(cj)
                if cj == '\\' and j + 1 < n:
                    out.append(js[j + 1])
                    j += 2
                    continue
                j += 1
                if cj == c:
                    break
            i = j
            expr_end = True
            prev_code = c
            continue
        if c == '`':
            out.append(c)
            stack.append(['tpl'])
            prev_code = '`'
            i += 1
            continue
        if c == '/' and i + 1 < n and js[i + 1] == '/':
            j = js.find('\n', i + 2)       # line comment — keep the newline
            i = n if j < 0 else j
            continue
        if c == '/' and i + 1 < n and js[i + 1] == '*':
            j = js.find('*/', i + 2)       # block comment -> single space
            out.append(' ')
            i = n if j < 0 else j + 2
            continue
        if c == '/':
            if expr_end:
                out.append(c)              # division (see approximation note)
                expr_end = False
                prev_code = '/'
                i += 1
                continue
            out.append(c)                  # regex literal — emit verbatim
            j, in_class = i + 1, False
            while j < n:
                cj = js[j]
                out.append(cj)
                if cj == '\\' and j + 1 < n:
                    out.append(js[j + 1])
                    j += 2
                    continue
                if cj == '\n':             # regex literals cannot span lines
                    j += 1
                    break
                if cj == '[':
                    in_class = True
                elif cj == ']':
                    in_class = False
                elif cj == '/' and not in_class:
                    j += 1
                    while j < n and (js[j].isalnum() or js[j] in '_$'):
                        out.append(js[j])  # regex flags
                        j += 1
                    break
                j += 1
            i = j
            expr_end = True
            prev_code = '/'
            continue
        if stack and stack[-1][0] == 'expr':
            if c == '{':
                stack[-1][1] += 1
            elif c == '}':
                if stack[-1][1] == 0:
                    stack.pop()            # ${…} closed — back to template text
                    out.append(c)
                    prev_code = '}'
                    i += 1
                    continue
                stack[-1][1] -= 1
        out.append(c)
        if not c.isspace():
            if c in '+-' and prev_code == c:
                expr_end = True            # postfix ++ / -- ends an expression
            else:                          # (gate r6 V2)
                expr_end = c.isalnum() or c in ')]_$'
            prev_code = c
        i += 1
    return ''.join(out)

def norm(value):
    return ' '.join(value.split())

def css_rules(css):
    """Return [(selector_stack, [(prop, normalized_value), …]), …] per rule
    block. Declarations attach to the innermost block; top-level declarations
    (style="" attribute bodies) come back with an empty stack. Structure is
    parsed over the shared escape-aware lexer (review r7): string tokens are
    OPAQUE — a brace, semicolon, colon or ESCAPED QUOTE inside a string can
    never corrupt the rule structure or hide a later --my-* definition
    (content:"foo\\"bar" followed by a drifted --my-bg definition was
    previously parsed clean)."""
    out, stack, buf = [], [], []
    decls = [[]]
    def flush():
        text = ''.join(buf); buf.clear()
        if ':' not in text:
            return
        prop, _, value = text.partition(':')
        decls[-1].append((prop.strip(), norm(value)))
    for kind, text in css_tokens(css):
        if kind == 'comment':
            continue
        if kind == 'string':
            buf.append(text)
            continue
        for ch in text:
            if ch == '{':
                stack.append(''.join(buf).strip()); buf.clear(); decls.append([])
            elif ch == '}':
                flush()
                if stack:
                    out.append((tuple(stack), decls.pop()))
                    stack.pop()
            elif ch == ';':
                flush()
            else:
                buf.append(ch)
    flush()
    if decls[-1]:
        out.append(((), decls[-1]))
    return out

TOKENS = {}
for _stack, _decls in css_rules((DESIGN_ROOT / 'tokens.css').read_bytes().decode('utf-8')):
    if not any(re.search(r'data-theme=["\']?dark|\.my-dark', s) for s in _stack):
        for p, v in _decls:
            if p.startswith('--my-'):
                TOKENS[p] = v

FAM_UI = re.compile(r'(?i)\bInter\b|--my-font-ui')
FAM_MONO = re.compile(r'(?i)JetBrains|--my-font-mono')
SIZE_TOK = re.compile(r'(?i)^(?:[\d.]+(?:px|em|rem|pt|%|vh|vw|ch)\b.*|var\(--my-fs[\w-]*[,)].*)')
IMPORTANT_RE = re.compile(r'(?i)\s*!\s*important\s*$')   # top-level priority only
VAR_SHAPE = re.compile(r'var\(\s*(--[\w-]+)\s*(?:,\s*(.*?)\s*)?\)')

def is_var(value):
    return VAR_SHAPE.fullmatch(IMPORTANT_RE.sub('', value.strip())) is not None

def card_local_tokens(style_blocks):
    """One pass over the card's OWN :root/[data-theme] custom-property
    declarations (incl. the --my-fw-* copies). Document order, last wins."""
    scope = re.compile(r'(?i):root|\[data-theme|\.my-dark')
    toks = {}
    for css in style_blocks:
        for stack, decls in css_rules(css):
            if stack and any(scope.search(s) for s in stack):
                for p, val in decls:
                    if p.startswith('--'):
                        toks[p] = val
    return toks

def resolve_weight(value, local_tokens=None, depth=0):
    if depth > 4:
        return None
    v = IMPORTANT_RE.sub('', value.strip())
    m = VAR_SHAPE.fullmatch(v)
    if m:
        tok = (local_tokens or {}).get(m.group(1))
        if tok is None:
            tok = TOKENS.get(m.group(1))
        if tok is not None:
            return resolve_weight(tok, local_tokens, depth + 1)
        if m.group(2):
            return resolve_weight(m.group(2), local_tokens, depth + 1)
        return None
    low = v.lower()
    if low == 'bold':
        return 700.0
    if low == 'normal':
        return 400.0
    if re.fullmatch(r'\d{1,4}(?:\.\d+)?', v):
        w = float(v)
        return w if 1 <= w <= 1000 else None
    return None

def resolve_style(value, local_tokens=None, depth=0):
    if depth > 4:
        return None
    v = IMPORTANT_RE.sub('', value.strip())
    m = VAR_SHAPE.fullmatch(v)
    if m:
        tok = (local_tokens or {}).get(m.group(1))
        if tok is None:
            tok = TOKENS.get(m.group(1))
        if tok is not None:
            return resolve_style(tok, local_tokens, depth + 1)
        if m.group(2):
            return resolve_style(m.group(2), local_tokens, depth + 1)
        return None
    if re.search(r'(?i)\b(italic|oblique)\b', v):
        return 'italic'
    if re.fullmatch(r'(?i)normal|inherit|unset|initial|revert(?:-layer)?', v):
        return 'normal'
    return None

def classify_family(fam_value):
    if not fam_value:
        return 'unknown'
    if FAM_MONO.search(fam_value):
        return 'mono'
    if FAM_UI.search(fam_value):
        return 'ui'
    low = norm(fam_value).lower()
    if low in ('inherit', 'unset', 'initial', 'revert') or low.startswith('var('):
        return 'unknown'
    return 'other'

def resolve_var_chain(value, local_tokens=None, depth=0):
    """Chase a var() chain to its literal text (card-local tokens first, then
    tokens.css, then the var() fallback), or None when unresolvable."""
    if depth > 4:
        return None
    v = IMPORTANT_RE.sub('', value.strip())
    m = VAR_SHAPE.fullmatch(v)
    if not m:
        return v
    tok = (local_tokens or {}).get(m.group(1))
    if tok is None:
        tok = TOKENS.get(m.group(1))
    if tok is not None:
        return resolve_var_chain(tok, local_tokens, depth + 1)
    if m.group(2):
        return resolve_var_chain(m.group(2), local_tokens, depth + 1)
    return None

def split_shorthand(value):
    """Shorthand tokenizer: whitespace-separated, but a var(...) — parens
    balanced, fallbacks included — is always ONE token."""
    toks, i, n = [], 0, len(value)
    while i < n:
        if value[i].isspace():
            i += 1
            continue
        if value[i:i + 4].lower() == 'var(':
            depth, j = 0, i
            while j < n:
                if value[j] == '(':
                    depth += 1
                elif value[j] == ')':
                    depth -= 1
                    if depth == 0:
                        j += 1
                        break
                j += 1
            toks.append(value[i:j])
            i = j
        else:
            j = i
            while j < n and not value[j].isspace():
                j += 1
            toks.append(value[i:j])
            i = j
    return toks

def shorthand_requests(value, local_tokens=None):
    """var() tokens resolve BEFORE classification — weight/style slots and the
    family tail alike (resolved literals are spliced in and reclassified). A
    parsed shorthand (size+family) RESETS unlisted longhands: weight 400 —
    only when genuinely omitted after resolution (an unresolved var() may BE
    the weight: reported, never guessed). Unresolved family-tail var() =
    conservative 'unknown' scope. Numeric weights span 1–1000, fractional
    kept exact."""
    weights, italic = [], False
    unresolved = []
    toks = split_shorthand(IMPORTANT_RE.sub('', value.strip()))
    i, splices = 0, 0
    unresolved_pre_size = False
    while i < len(toks):
        tk = toks[i]
        if SIZE_TOK.match(tk):
            tail, tail_unres = [], False
            for t in toks[i + 1:]:
                if VAR_SHAPE.fullmatch(t):
                    r = resolve_var_chain(t, local_tokens)
                    if r is None:
                        tail_unres = True
                    else:
                        tail.append(r)
                else:
                    tail.append(t)
            fam_part = ' '.join(tail)
            fam_class = (classify_family(fam_part) if fam_part
                         else ('unknown' if tail_unres else None))
            if fam_class == 'other' and tail_unres:
                fam_class = 'unknown'
            if not weights and not unresolved_pre_size:
                weights.append(400.0)   # the shorthand reset — weight genuinely omitted
            return weights, italic, fam_class, unresolved
        if VAR_SHAPE.fullmatch(tk) and splices < 8:
            r = resolve_var_chain(tk, local_tokens)
            if r is None:
                unresolved_pre_size = True
                unresolved.append(('font (shorthand)', tk))
                i += 1
                continue
            toks[i:i + 1] = split_shorthand(r)   # reclassify the resolved literal
            splices += 1
            continue
        low = tk.lower()
        if low in ('italic', 'oblique'):
            italic = True
        elif low == 'bold':
            weights.append(700.0)
        elif re.fullmatch(r'\d{1,4}(?:\.\d+)?', tk) and 1 <= float(tk) <= 1000:
            weights.append(float(tk))
        i += 1
    return [], False, None, unresolved

def font_requests(style_blocks, inline_styles, local_tokens=None):
    reqs = set()
    unresolved = []   # check-ds.sh reports these; here they just carry no weight
    sources = list(style_blocks) + ['x{' + s + '}' for s in inline_styles]
    for css in sources:
        for stack, decls in css_rules(css):
            if any(s.lower().startswith('@font-face') for s in stack):
                continue
            dmap = {}
            for p, v in decls:
                dmap[p.lower()] = v
            weights, italic, fam_class = [], False, None
            rule_unresolved = []
            if 'font' in dmap:
                w2, it2, fc, sh_unres = shorthand_requests(dmap['font'], local_tokens)
                weights += w2
                italic = italic or it2
                if fc:
                    fam_class = fc
                rule_unresolved += sh_unres
            if 'font-family' in dmap:
                fam_class = classify_family(dmap['font-family'])
            if 'font-weight' in dmap:
                w = resolve_weight(dmap['font-weight'], local_tokens)
                if w is not None:
                    weights.append(w)
                elif is_var(dmap['font-weight']):
                    rule_unresolved.append(('font-weight', dmap['font-weight']))
            if 'font-style' in dmap:
                fs = resolve_style(dmap['font-style'], local_tokens)
                if fs == 'italic':
                    italic = True
                elif fs is None and is_var(dmap['font-style']):
                    rule_unresolved.append(('font-style', dmap['font-style']))
            fam_class = fam_class or 'unknown'
            if fam_class == 'other':
                continue
            for w in weights:
                reqs.add((fam_class, 'weight', w))
            if italic:
                reqs.add((fam_class, 'italic', None))
            unresolved += rule_unresolved
    return reqs, unresolved

used = set()
all_reqs = set()
weight_cards = {}   # Inter-scoped weight -> {card names} (error attribution)
for card in sorted((d / 'ds').glob('*.html')):
    p = TextCollector()
    p.feed(card.read_bytes().decode('utf-8'))
    p.close()
    for chunk in p.chunks:
        used.update(ord(c) for c in chunk if ord(c) >= 0x20)
    reqs, _unresolved = font_requests(p.styles, p.inline_styles,
                                      card_local_tokens(p.styles))
    if p.bold_markup:
        # UA default for <b>/<strong>/<h1>–<h6>/<th>
        reqs.add(('unknown', 'weight', 700.0))
    all_reqs |= reqs
    for fc, kind, w in reqs:
        if kind == 'weight' and fc in ('ui', 'unknown'):
            weight_cards.setdefault(float(w), set()).add(card.name)

def wnum(w):
    """Exact numeric weight -> JSON-able number (int when integral — no
    truncation: fractional weights stay fractional end-to-end)."""
    return int(w) if float(w).is_integer() else float(w)

def wfmt(w):
    """Exact numeric weight -> CSS/manifest string ('400', '650.5')."""
    return f'{float(w):g}'

# Inter weights the cards request (ui-scoped + family-less rules — mirror of the
# coverage scan in check-ds.sh); this drives the fallback instancing list.
inter_weights = sorted({float(w) for fc, kind, w in all_reqs
                        if kind == 'weight' and fc in ('ui', 'unknown')}) or [400.0]

GLYPHS = '✓✕✎⚠●◐◑◇◈◉⬤▲▸▾▍⌘⎇⇧⏎ℹ←↑→↓−∞≤≥⋯🔒'
floor = (set(range(0x20, 0x7F)) | set(range(0xA0, 0x100))
         | set(range(0x2000, 0x2070)) | {ord(c) for c in GLYPHS})
codepoints = sorted(used | floor)
extra = sorted(used - floor)
print(f'codepoints: {len(used)} used in ds/ cards, {len(codepoints)} total with '
      f'stability floor ({len(extra)} above the floor: '
      + (' '.join(chr(c) for c in extra) or '—') + ')')
print('requested Inter weights (CSS-derived, drives fallback instancing): '
      + str([wnum(w) for w in inter_weights]))

# --- 2. subset -------------------------------------------------------------------
FONTS = DESIGN_ROOT / 'assets' / 'fonts'

def subset(src, unicodes):
    """Subset src woff2 -> (bytes, cmap-missing-codepoints)."""
    opts = Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']   # keep tnum &c. — cards rely on tabular-nums
    font = load_font(str(src), opts)
    covered = set()
    for table in font['cmap'].tables:
        if table.isUnicode():
            covered.update(table.cmap)
    missing = sorted(set(unicodes) - covered)
    s = Subsetter(options=opts)
    s.populate(unicodes=unicodes)
    s.subset(font)
    buf = io.BytesIO()
    save_font(font, buf, opts)
    font.close()
    return buf.getvalue(), missing

def instanced_inter(src, unicodes, wght):
    """Pin the variable font to one weight (other axes at defaults), then subset."""
    font = TTFont(str(src))
    axes = {a.axisTag: a.defaultValue for a in font['fvar'].axes}
    axes['wght'] = wght
    # updateFontNames=False: True requires STAT Axis Values for the pinned
    # weight, and Inter's STAT only carries its named instances (the hundreds)
    # — any other requested weight (650, 650.5, …) would crash the fallback.
    # The name table is irrelevant here anyway: the cards consume these files
    # through @font-face declarations built from the manifest family/weight.
    instancer.instantiateVariableFont(font, axes, inplace=True,
                                      updateFontNames=False)
    tmp = io.BytesIO()
    font.save(tmp)
    font.close()
    tmp.seek(0)
    opts = Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    inst = load_font(tmp, opts)
    covered = set()
    for table in inst['cmap'].tables:
        if table.isUnicode():
            covered.update(table.cmap)
    missing = sorted(set(unicodes) - covered)
    s = Subsetter(options=opts)
    s.populate(unicodes=unicodes)
    s.subset(inst)
    buf = io.BytesIO()
    save_font(inst, buf, opts)
    inst.close()
    return buf.getvalue(), missing

MONO = [('JetBrainsMono-Regular.woff2', '400'),
        ('JetBrainsMono-Medium.woff2', '500'),
        ('JetBrainsMono-Bold.woff2', '700')]

# the variable Inter wght axis range — recorded in the manifest so check-ds.sh can
# validate requested weights against it (variable mode covers the whole axis)
_vf = TTFont(str(FONTS / 'InterVariable.woff2'))
_wght = next(a for a in _vf['fvar'].axes if a.axisTag == 'wght')
inter_axis = [float(_wght.minValue), float(_wght.maxValue)]
_vf.close()

results = {}   # name -> (bytes, missing, family, weight, extra_meta)
for name, weight in MONO:
    data, missing = subset(FONTS / name, codepoints)
    results[name] = (data, missing, 'JetBrains Mono', weight, {})

inter_var, inter_missing = subset(FONTS / 'InterVariable.woff2', codepoints)
mode = 'variable'
mode_note = ('InterVariable.woff2 subset with the weight axis kept '
             '(default pyftsubset axis retention, no instancing).')
sources_used = ['InterVariable.woff2'] + [n for n, _ in MONO]
total = len(inter_var) + sum(len(r[0]) for r in results.values())
if total > BUDGET:
    mode = 'instanced'
    weights_note = [wnum(w) for w in inter_weights]
    mode_note = (f'variable Inter subset was {len(inter_var)} B (total {total} B > '
                 f'{BUDGET} B budget) — fell back to static instances at the '
                 f'card-CSS-derived weights {weights_note} via fontTools.varLib.instancer.')
    print(f'variable Inter subset too big ({len(inter_var)} B, total {total} B) — '
          f'instancing card-CSS-derived weights {weights_note} instead')
    # NO silent clamping: a request outside the source wght axis would produce a
    # mislabeled instance (a file named for a weight the source cannot render).
    # Refuse with the card(s) and request named — fix the card CSS instead.
    bad = [w for w in inter_weights if not (inter_axis[0] <= w <= inter_axis[1])]
    if bad:
        for w in bad:
            who = ', '.join(f'ds/{c}' for c in sorted(weight_cards.get(w, ()))) \
                  or 'unknown card'
            print(f'error: {who} requests Inter font-weight {wfmt(w)}, outside the '
                  f'InterVariable wght axis {inter_axis[0]:g}-{inter_axis[1]:g} — '
                  'refusing to clamp/mislabel a static instance; fix the card CSS '
                  'or ship a source face covering it', file=sys.stderr)
        raise SystemExit(1)
    inter = {}
    for wght in inter_weights:
        data, missing = instanced_inter(FONTS / 'InterVariable.woff2', codepoints, wght)
        # decimal-safe filename: 650.5 -> Inter-w650_5.woff2
        inter[f'Inter-w{wfmt(wght).replace(".", "_")}.woff2'] = (
            data, missing, 'Inter', wfmt(wght), {})
    results = {**inter, **results}
else:
    results = {'InterVariable.woff2': (
                   inter_var, inter_missing, 'Inter',
                   f'{inter_axis[0]:g} {inter_axis[1]:g}',
                   {'wghtAxis': inter_axis}),
               **results}

# --- 3. write outputs + manifest -------------------------------------------------
OUT.mkdir(parents=True, exist_ok=True)
for stale in OUT.glob('*.woff2'):
    if stale.name not in results:
        stale.unlink()
        print(f'removed stale {stale.name}')

files = {}
total = 0
for name, (data, missing, family, weight, extra_meta) in results.items():
    (OUT / name).write_bytes(data)
    total += len(data)
    files[name] = {
        'sha256': hashlib.sha256(data).hexdigest(),
        'bytes': len(data),
        'family': family,
        'weight': weight,
        'style': 'normal',
        **extra_meta,
    }
    if missing:
        files[name]['missingCodepoints'] = missing
    print(f'  {name}: {len(data):,} B ({len(data)/1024:.1f} KB)'
          + (f' — {len(missing)} requested codepoint(s) not in source font: '
             + ' '.join(f'U+{c:04X}' for c in missing) if missing else ''))
print(f'total payload: {total:,} B ({total/1024:.1f} KB), mode={mode}')

manifest = {
    'generatedBy': 'subset-ds-fonts.sh',
    'date': datetime.date.today().isoformat(),
    'mode': mode,
    'modeNote': mode_note,
    'note': ('Font subsets for the self-contained ds/ cards. files[*] sha256/bytes are '
             'the payloads check-ds.sh verifies inside every card\'s @dsFonts block '
             '(family/weight/style feed its @font-face generation; the variable Inter '
             'face records its wght axis range as wghtAxis for the weight-coverage '
             'check). This manifest is the sole authority over ds-subset/: files not '
             'recorded here are flagged as stale. sources are the sha256s of the '
             'canonical assets/fonts/ files these subsets were built from — when they '
             'drift, check-ds.sh says "canonical fonts changed". codepoints is the '
             'sorted list the subsets are built to cover — the contract check-ds.sh '
             'validates cards against (rendered text + rendered attributes only; '
             'runtime-generated glyphs are out of static reach); missingCodepoints '
             '(per file) are requested codepoints the source font itself lacks (they '
             'fall through to system fonts, exactly as with the full canonical font). '
             'requestedWeights are the card-CSS-derived weights (diagnostic; drives '
             'fallback instancing). Italics are not subset: no ds/ card uses them.'),
    'sources': {name: hashlib.sha256((FONTS / name).read_bytes()).hexdigest()
                for name in sources_used},
    'requestedWeights': [wnum(w) for w in inter_weights],
    'files': files,
    'codepoints': codepoints,
    'totalBytes': total,
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
print(f'wrote {OUT / "manifest.json"} ({len(codepoints)} codepoints)')
PY
