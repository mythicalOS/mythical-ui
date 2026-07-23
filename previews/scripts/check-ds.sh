#!/usr/bin/env bash
# check-ds.sh — the executable drift control for the ds/ Design-pane cards.
#
#   ./scripts/check-ds.sh          validate; exit non-zero listing every violation
#   ./scripts/check-ds.sh --fix    STAGED mechanical repairs (see below), then validate
#
# python3 STDLIB ONLY — no fontTools, no packages: this is the script the repo
# depends on at check time (`npm run check:ds`). Regenerating the font subsets
# themselves needs ./scripts/subset-ds-fonts.sh (which does require fontTools).
#
# THREAT MODEL: this tool guards against ACCIDENTAL drift by cooperating
# authors, not sabotage of one's own repo. Two reviewed hardenings were
# DECLINED on that boundary — recorded here so the decision is durable:
#   - CSS-escape-obfuscated token names (e.g. `--\6d y-bg` evading the --my-*
#     scan): an author obfuscating their own tokens is sabotaging their own
#     repo — out of scope for a drift control.
#   - a token-stream (whitespace/comma-insensitive) CSS comparator: declined
#     deliberately. Tool-converged copies should be byte-faithful, and the
#     comma-spacing "false positives" such a comparator would forgive were
#     precisely the hand-drifted copies this tool exists to converge.
# KNOWN LIMIT (accepted): glyphs produced dynamically at runtime
# (String.fromCodePoint etc.) cannot be statically collected. The subset's
# stability floor covers realistic cases; authors adding exotic dynamic glyphs
# must rerun ./scripts/subset-ds-fonts.sh.
#
# Validations (each ds/*.html is a self-contained card the claude.ai Design pane
# renders as-is — DesignSync uploads committed files straight from disk):
#   a. first line is exactly `<!-- @dsCard group="…" -->` (the pane's
#      registration marker — must stay line 1); the group value contains no
#      `-->`/control characters and matches the filename-prefix convention:
#      brand-*→Brand, components-*→Components, foundations-*→Foundations,
#      layouts-*→Layouts.
#   b. self-containment: every URL-bearing attribute (src/href/xlink:href/
#      poster/background/cite/action/formaction/longdesc, <object data>) and
#      every srcset/imagesrcset candidate may hold ONLY a data: URI, a
#      `#fragment` reference, or nothing — a card can load NOTHING at render
#      time, so http(s) and protocol-relative (`//host/…`) URLs AND relative
#      file references (`missing.png` could never resolve inside a
#      self-contained card, existing or not) are all violations; no
#      <link rel=stylesheet>; no <script src>; no <meta http-equiv="refresh">
#      carrying a URL; no CSS url()/@import target other than data: or
#      #fragment (checked in <style> blocks AND style="" attributes);
#      <iframe srcdoc> content is scanned recursively. xmlns attributes and
#      plain-text/comment http mentions stay allowed.
#   c. token identity: every `--my-*: value` DEFINED in a card's CSS (<style>
#      blocks + style="" attributes) matches the canonical value in tokens.css
#      for the corresponding theme block (light `:root` vs dark
#      `[data-theme="dark"]`/`.my-dark` — dark inherits light for tokens the
#      dark block does not override). Whitespace-insensitive compare; reports
#      token, card, card value and canonical value on mismatch. Every
#      `var(--my-…)` REFERENCE in the card's CSS (<style> blocks + style=""
#      attributes) must also resolve: the referenced name must exist in
#      canonical tokens.css (light ∪ dark) or among the card's own local
#      definitions. A var() fallback does NOT excuse a dangling reference —
#      `var(--my-x, 10px)` with no --my-x anywhere IS the drift case (token
#      renamed canonically, card left behind). Non-`--my-*` custom properties
#      are out of scope (cards may define private vars); script-injected CSS
#      is out of static reach (same documented boundary as dynamic glyphs).
#   d. inline-source identity: @dsInline blocks are located STRUCTURALLY —
#      exact full-line markers, OPENERS AND CLOSERS alike, outside <script>
#      content; marker-shaped text inside scripts is ignored, never repaired,
#      and never accepted as a closer (the closing `</script>` + closer pair
#      must terminate the block's OWN <script> span). An opener without a
#      legitimate closer is a violation and --fix refuses the card. Every
#      block must name a file the fixed allowlist (INLINE_ALLOW) permits for
#      that card: a marker naming any other file, or any @dsInline block in a
#      card absent from the allowlist, is a violation and is REFUSED by --fix
#      (the wrong source is never embedded). The allowlist is also a
#      REQUIREMENT: an allowlisted card must carry EXACTLY ONE @dsInline block
#      per allowed file — a missing block or a duplicate is a violation, and
#      --fix never conjures a missing block (placement is a human decision).
#      Allowed payloads must be BYTE-identical to the canonical repo-root
#      file — no newline normalization; a CRLF/LF divergence is a violation.
#   e. fonts: exactly one `@dsFonts` block per card, located structurally
#      (exact full-line markers — closers included — outside <script> content,
#      required to appear before the first <script> tag; an opener without a
#      legitimate closer is a violation and --fix refuses the card). The block
#      text must EQUAL — byte for byte — the block this script
#      regenerates in memory from manifest.json + the assets/fonts/ds-subset/
#      files (subsumes payload/family/weight/style/CSS-structure checks), and
#      must sit inside <head>: after <meta charset> when present, before
#      </head>. manifest.json is the sole authority over ds-subset/: every
#      manifest file must exist with a matching sha256, ds-subset/ may hold
#      NOTHING the manifest does not record, and the SOURCE fonts in
#      assets/fonts/ must still match the sha256s recorded at subset time
#      (else: canonical fonts changed — rerun ./scripts/subset-ds-fonts.sh). Every
#      codepoint in the card's renderable text (markup text + rendered
#      attributes; <script>/<style> source contributes COMMENT-STRIPPED — JS
#      /* */ and // comments outside string/template literals and CSS /* */
#      comments never render, while string/template literal text stays
#      collected: the select script injects real glyphs from strings) must be
#      covered by the manifest codepoint list, and every
#      font-weight / font-style the card's CSS requests for the Inter /
#      JetBrains Mono families must be coverable by the manifest faces:
#      variable Inter covers its recorded wght axis range; static JetBrains
#      Mono covers exactly its face weights plus the CSS font-matching
#      resolution 650→700 (desired weight ≥600 searches ascending); any
#      font-style:italic request fails — no italic faces ship. Weight parsing
#      is CSS-correct: numeric weights span 1–1000 (fractional kept exact), a
#      parsed `font:` shorthand without an explicit weight requests 400 (the
#      shorthand resets weight — only when the weight is GENUINELY omitted
#      after var() resolution), top-level !important is stripped before
#      parsing, and var() values resolve through the card's own
#      :root/[data-theme] declarations then tokens.css — in `font:` shorthand
#      slots (weight/style/family tail) as well as longhands. A DS-family
#      font-weight/font-style var() that stays unresolved is itself a
#      violation; an unresolved var() in a family position classifies
#      conservatively as unknown-scope (both DS families). <b>/<strong>/<h1>–<h6>/<th> occurrences conservatively
#      request weight 700 (the UA default).
#
# --fix performs MECHANICAL repairs only, and STAGES them: the fully repaired
# card is built in memory (re-embed allowlisted @dsInline sources; regenerate /
# inject the @dsFonts block), the COMPLETE validation runs against that
# in-memory result, and the file is written ONLY if it validates clean —
# otherwise the card is reported and left untouched. --fix NEVER edits
# anything else: token mismatches, containment violations and marker problems
# are design decisions — humans fix those. When violations exist at the
# manifest/source level (source-font hash drift, unlisted ds-subset/ files,
# missing faces), --fix performs NO card writes at all — global integrity
# first: rerun ./scripts/subset-ds-fonts.sh, then ./scripts/check-ds.sh --fix.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 - "$@" <<'PY'
import base64, bisect, hashlib, html.parser, json, pathlib, re, sys

args = sys.argv[1:]
FIX = '--fix' in args
if [a for a in args if a != '--fix']:
    print('usage: ./scripts/check-ds.sh [--fix]', file=sys.stderr)
    raise SystemExit(2)

d = pathlib.Path('.')
DS = d / 'ds'
# repo root (Task 9 repoint): this script now lives at previews/scripts/, one
# level below the mythical-ui repo root — @dsInline sources (e.g. the select
# component) are resolved from there, not from this previews/ directory.
REPO_ROOT = d / '..'
# sibling checkout (Task 9 repoint): tokens.css AND the canonical source .woff2
# files it's subset from now live in the sibling mythical-design checkout, the
# same sibling-checkout resolution packages/ui-core/test/css.test.ts relies on.
# ds-subset/ itself (the derived, card-specific subsets) stays local.
DESIGN_ROOT = d / '..' / '..' / 'mythical-design'
CANON_FONTS_DIR = DESIGN_ROOT / 'assets' / 'fonts'
SUBSET = d / 'assets' / 'fonts' / 'ds-subset'
MANIFEST = SUBSET / 'manifest.json'
TOKENS = DESIGN_ROOT / 'tokens.css'

# Fixed @dsInline allowlist: card -> the only source files it may embed —
# AND MUST embed, in exactly one block each (the list is a requirement, not a
# permission: zero blocks or duplicates are violations). A marker naming any
# other file — or any @dsInline block in a card absent here — is a violation,
# and --fix refuses to embed it. --fix never conjures a missing block:
# placement is a human decision. Paths are relative to REPO_ROOT (mythical-ui).
INLINE_ALLOW = {
    'components-select.html': {'packages/ui-core/src/select/mythical-select.js'},
}

# Registration-group convention: filename prefix -> required @dsCard group.
GROUP_BY_PREFIX = {
    'brand': 'Brand',
    'components': 'Components',
    'foundations': 'Foundations',
    'layouts': 'Layouts',
}

# Codepoint collection: only attribute values that actually RENDER feed the
# coverage check. Non-rendered attributes (data-*, id, class, name, role,
# href/src, aria-* other than aria-label/aria-valuetext, style keys, …) are
# excluded. NOTE: mirrored in subset-ds-fonts.sh — keep the two in sync.
RENDERED_ATTRS = {'title', 'alt', 'aria-label', 'aria-valuetext',
                  'placeholder', 'value', 'label'}

violations = []
def vio(card, cat, msg):
    violations.append(f'{card} [{cat}] {msg}')

def read_text_bytes(p):
    """Byte-faithful read: NO newline translation. (Path.read_text() folds
    CRLF to LF and would hide divergence — identity checks here are byte
    checks; --fix embeds canonical bytes verbatim.)"""
    return p.read_bytes().decode('utf-8')

# ---------- CSS parsing (comment-stripped, quote-aware) ----------
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

DARK_SEL = re.compile(r'data-theme=["\']?dark|\.my-dark')

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

def css_my_declarations(css):
    """Yield (selector_stack, prop, value) for every --my-* declaration."""
    for stack, ds_ in css_rules(css):
        for prop, value in ds_:
            if prop.startswith('--my-'):
                yield stack, prop, value

# var(--my-…) REFERENCE scan: `var(` matches case-insensitively (CSS function
# names are), the `--my-` prefix case-SENSITIVELY (custom property names are
# case-sensitive — a --MY-* name is not a DS token and is out of scope, like
# every other non-`--my-*` custom property). finditer over a declaration value
# also reaches names nested inside var() fallbacks: var(--my-a, var(--my-b)).
MY_REF = re.compile(r'(?i:var)\(\s*(--my-[-\w]*)')

def css_code_only(value):
    """The declaration value with its string tokens dropped, via the shared
    escape-aware CSS lexer (gate r5 U4): CSS performs NO var() substitution
    inside strings, so `content:"var(--my-x)"` is literal text, not a
    reference — and escape-aware lexing means a `\\"` inside a string can
    neither hide a REAL reference after the string nor expose fake ones.
    Code fragments are joined with a space so a match can never straddle a
    dropped string (a real var() reference contains no quotes)."""
    return ' '.join(t for k, t in css_tokens(value) if k == 'code')

# canonical theme maps from tokens.css
canon_light, canon_dark_over = {}, {}
for stack, prop, value in css_my_declarations(read_text_bytes(TOKENS)):
    if any(DARK_SEL.search(s) for s in stack):
        canon_dark_over[prop] = value
    else:
        canon_light[prop] = value
canon_dark = {**canon_light, **canon_dark_over}   # dark inherits light

# ---------- typography requests derived from card CSS ----------
# NOTE: the request scan (families/weights) is mirrored in subset-ds-fonts.sh
# (it derives the fallback instancing weight list) — keep the two in sync.
FAM_UI = re.compile(r'(?i)\bInter\b|--my-font-ui')
FAM_MONO = re.compile(r'(?i)JetBrains|--my-font-mono')
SIZE_TOK = re.compile(r'(?i)^(?:[\d.]+(?:px|em|rem|pt|%|vh|vw|ch)\b.*|var\(--my-fs[\w-]*[,)].*)')
IMPORTANT_RE = re.compile(r'(?i)\s*!\s*important\s*$')   # top-level priority only
VAR_SHAPE = re.compile(r'var\(\s*(--[\w-]+)\s*(?:,\s*(.*?)\s*)?\)')

def is_var(value):
    return VAR_SHAPE.fullmatch(IMPORTANT_RE.sub('', value.strip())) is not None

def card_local_tokens(style_blocks):
    """One pass over the card's OWN :root/[data-theme] custom-property
    declarations (incl. the --my-fw-* copies) — the map that resolves var()
    indirection in the card's typography values. Document order, last wins."""
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
    """font-weight value -> numeric weight (CSS range 1–1000, fractional kept
    exact), or None when outside static reach (inherit/bolder/lighter/
    unresolvable var()). Top-level !important is stripped; var() resolves
    through the card's own :root/[data-theme] tokens, then tokens.css."""
    if depth > 4:
        return None
    v = IMPORTANT_RE.sub('', value.strip())
    m = VAR_SHAPE.fullmatch(v)
    if m:
        tok = (local_tokens or {}).get(m.group(1))
        if tok is None:
            tok = canon_light.get(m.group(1))
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
    """font-style value -> 'italic' | 'normal' | None (unresolvable).
    Same !important stripping + card-local/canonical var() resolution as
    resolve_weight; statically-neutral keywords count as 'normal'."""
    if depth > 4:
        return None
    v = IMPORTANT_RE.sub('', value.strip())
    m = VAR_SHAPE.fullmatch(v)
    if m:
        tok = (local_tokens or {}).get(m.group(1))
        if tok is None:
            tok = canon_light.get(m.group(1))
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
    return 'other'   # an explicit non-DS family — outside this check's scope

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
        tok = canon_light.get(m.group(1))
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
    """`font:` shorthand -> (weights, italic, family_class_or_None, unresolved).
    var() tokens are resolved BEFORE classification — in the weight/style
    slots and the family tail alike (a resolved literal is spliced in and
    reclassified). A parsed shorthand (size+family) RESETS unlisted longhands
    to their initial values: font-weight 400 — but ONLY when the weight is
    genuinely omitted after resolution; an unresolved var() may BE the weight,
    so it is reported as unresolvable (violation on DS-scoped rules), never
    guessed at. An unresolved var() in the FAMILY tail classifies
    conservatively as 'unknown' (coverable by BOTH DS families), matching the
    longhand font-family convention — family identity is a scope question,
    not a coverage value. Numeric weights parse across the CSS range 1–1000
    (fractional kept exact)."""
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
                        tail_unres = True   # could be a DS family — stay conservative
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
    # no size token (e.g. font:inherit) — nothing derivable, but an
    # unresolvable var() is still worth reporting on DS-scoped rules
    return [], False, None, unresolved

def font_requests(style_blocks, inline_styles, local_tokens=None):
    """(reqs, unresolved): reqs is the set of (family_class, 'weight', w) /
    (family_class, 'italic', None) requests the card's CSS makes; unresolved
    lists (prop, raw_value) for DS-scoped font-weight/font-style var() values
    that neither the card's own tokens nor tokens.css resolve — those are
    violations (a weight the static analysis cannot see is a weight the
    coverage check cannot guard). Classification is per-rule: a rule declaring
    a font-family (or shorthand family) gets that class; rules without one are
    'unknown' and must be coverable by BOTH DS families (mono is opt-in per
    rule, but static analysis cannot resolve the cascade). @font-face rule
    bodies are descriptors, not requests — skipped."""
    reqs = set()
    unresolved = []
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

FAMS_FOR = {'ui': ('Inter',), 'mono': ('JetBrains Mono',),
            'unknown': ('Inter', 'JetBrains Mono')}

def family_covers_weight(files, family, w):
    statics = set()
    for meta in files.values():
        if meta.get('family') != family or meta.get('style', 'normal') != 'normal':
            continue
        ws = [float(x) for x in str(meta.get('weight', '400')).split()]
        if len(ws) == 2:
            lo, hi = meta.get('wghtAxis', ws)   # variable face: recorded axis range
            if lo <= w <= hi:
                return True
        else:
            statics.add(ws[0])
    if w in statics:
        return True
    # CSS font-matching: a desired weight >= 600 searches ASCENDING first — the
    # DS's 650 semibold therefore resolves up to a 700 static face. Exactly that
    # resolution (650 -> 700) is accepted; any other uncovered weight is drift.
    return w == 650 and 700.0 in statics

def family_has_italic(files, family):
    return any(m.get('family') == family and m.get('style') == 'italic'
               for m in files.values())

# ---------- HTML scanning ----------
URLISH = re.compile(r'(?i)^\s*(?:https?:)?//')
URL_ATTRS = {'src', 'href', 'xlink:href', 'poster', 'background', 'cite',
             'action', 'formaction', 'longdesc'}

def resource_ref_problem(value):
    """Self-containment for a resource-bearing attribute value. A rendered
    card can load NOTHING, so the only legitimate forms are data: URIs,
    `#fragment` references and the empty string (a no-op — same allowance as
    the CSS-side url('')). Everything else is a violation: http(s) and
    protocol-relative URLs, but equally RELATIVE file references — existing
    or not, `missing.png` could never resolve inside the self-contained card
    the Design pane renders. Returns a reason string, or None when allowed.
    (Calibrated against the corpus 2026-07-22: the 23 cards carry no
    resource-bearing attribute values at all — no <a href> of any kind — so
    no http(s)-on-<a> carve-out exists; xmlns is not a resource attribute and
    plain-text/comment URL mentions never reach this check.)"""
    s = value.strip()
    if s == '' or s.startswith('#') or s.lower().startswith('data:'):
        return None
    if URLISH.match(s):
        return 'external or protocol-relative reference'
    return ('non-self-contained resource reference — only data: URIs and '
            '#fragment references can resolve inside a self-contained card')

def srcset_urls(value):
    """WHATWG-approximate srcset candidate URL extraction: a candidate URL is
    a maximal non-whitespace run (so data: URIs — which legally contain
    commas — survive intact); a URL with trailing comma(s) ends its candidate
    there, otherwise everything up to the next comma is its descriptor."""
    urls, i, n = [], 0, len(value)
    while i < n:
        while i < n and (value[i].isspace() or value[i] == ','):
            i += 1
        j = i
        while j < n and not value[j].isspace():
            j += 1
        url = value[i:j]
        if not url:
            break
        if url.endswith(','):
            urls.append(url.rstrip(','))
            i = j
        else:
            urls.append(url)
            k = value.find(',', j)
            i = n if k < 0 else k + 1
    return [u for u in urls if u]
# Tags whose UA default is font-weight:700 — each occurrence is a conservative
# weight-700 request for whichever DS family applies (CSS may restyle them, but
# static analysis takes the superset; same logic for all of them).
BOLD_TAGS = {'b', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'th'}
# NOTE: <i>/<em> are NOT treated as italic requests: the corpus uses them as
# reset (font-style:normal) or empty decorative elements; CSS-declared
# font-style is the contract this tool checks.

class CardScan(html.parser.HTMLParser):
    """One pass over a card: renderable text (rendered-attrs only), <style>
    contents, style="" attributes, containment findings, structural positions
    (script content spans, first <script>, <head>/<meta charset> offsets) and
    UA-default bold markup.
    NOTE: text-extraction logic mirrored in subset-ds-fonts.sh — keep in sync."""
    def __init__(self, line_starts=None):
        super().__init__(convert_charrefs=True)
        self._line_starts = line_starts
        self.text = []           # renderable text chunks
        self.styles = []         # <style> contents
        self.inline_styles = []  # style="" attribute values
        self.containment = []    # (category, message)
        self._in_style = False
        self._in_script = False
        self._script_buf = []    # script SOURCE — comment-stripped at flush
        self._style_buf = []     # style SOURCE — CSS-comment-stripped at flush
        self.script_spans = []   # (start_tag_line, end_tag_line), 1-based
        self._script_open_line = None
        self.first_script_off = None
        self.head_open_end = None
        self.head_close_off = None
        self.charset_end = None
        self.bold_markup = False

    def _off(self):
        if self._line_starts is None:
            return None
        line, col = self.getpos()
        return self._line_starts[line - 1] + col

    def handle_data(self, data):
        # <script>/<style> SOURCE is buffered and flushed to `text` with its
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
        self.text.append(data)

    def _flush_source_text(self):
        if self._script_buf:
            self.text.append(strip_js_comments(''.join(self._script_buf)))
            self._script_buf = []
        if self._style_buf:
            self.text.append(strip_css_comments(''.join(self._style_buf)))
            self._style_buf = []

    def handle_starttag(self, tag, attrs, selfclosing=False):
        amap = {k.lower(): (v or '') for k, v in attrs}
        self.text.extend(v for k, v in attrs
                         if v and k.lower() in RENDERED_ATTRS)
        if tag == 'style' and not selfclosing:
            self._in_style = True
        if 'style' in amap:
            self.inline_styles.append(amap['style'])
        if tag in BOLD_TAGS:
            self.bold_markup = True
        # ---- structural positions ----
        off = self._off()
        raw = self.get_starttag_text() or ''
        if tag == 'script':
            if not selfclosing:
                self._in_script = True
                line, _ = self.getpos()
                self._script_open_line = line + raw.count('\n')
            if self.first_script_off is None and off is not None:
                self.first_script_off = off
        if tag == 'head' and self.head_open_end is None and off is not None:
            self.head_open_end = off + len(raw)
        if (tag == 'meta' and 'charset' in amap and self.charset_end is None
                and off is not None):
            self.charset_end = off + len(raw)
        # ---- containment ----
        if tag == 'link' and 'stylesheet' in amap.get('rel', '').lower():
            self.containment.append(('containment',
                '<link rel=stylesheet> (external stylesheet)'))
        if tag == 'script' and 'src' in amap:
            self.containment.append(('containment',
                f'<script src="{amap["src"][:80]}"> (external script)'))
        if (tag == 'meta' and amap.get('http-equiv', '').lower() == 'refresh'
                and re.search(r'(?i)url\s*=', amap.get('content', ''))):
            self.containment.append(('containment',
                '<meta http-equiv="refresh"> with a URL (navigation defeats self-containment)'))
        for k, v in attrs:
            v = v or ''
            kl = k.lower()
            if kl in URL_ATTRS or (kl == 'data' and tag == 'object'):
                why = resource_ref_problem(v)
                if why:
                    self.containment.append(('containment',
                        f'<{tag} {k}="{v[:80]}"> ({why})'))
            if kl in ('srcset', 'imagesrcset') and v:
                for url in srcset_urls(v):
                    why = resource_ref_problem(url)
                    if why:
                        self.containment.append(('containment',
                            f'<{tag} {kl}> candidate "{url[:80]}" ({why})'))
            if kl == 'srcdoc' and tag == 'iframe' and v:
                sub = CardScan()
                sub.feed(v)
                sub.close()
                self.text.extend(sub.text)
                self.styles.extend(sub.styles)
                self.inline_styles.extend(sub.inline_styles)
                self.bold_markup = self.bold_markup or sub.bold_markup
                for cat, msg in sub.containment:
                    self.containment.append((cat, f'iframe srcdoc: {msg}'))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs, selfclosing=True)

    def handle_endtag(self, tag):
        if tag == 'style':
            self._in_style = False
            self._flush_source_text()
        if tag == 'script':
            self._in_script = False
            self._flush_source_text()
            if self._script_open_line is not None:
                line, _ = self.getpos()
                self.script_spans.append((self._script_open_line, line))
                self._script_open_line = None
        if tag == 'head' and self.head_close_off is None:
            self.head_close_off = self._off()

    def close(self):
        super().close()
        self._flush_source_text()                  # unclosed <script>/<style> at EOF
        if self._script_open_line is not None:     # unclosed <script> at EOF
            self.script_spans.append((self._script_open_line, 1 << 60))
            self._script_open_line = None

def used_codepoints(scan):
    cps = set()
    for chunk in scan.text:
        cps.update(ord(c) for c in chunk
                   if ord(c) >= 0x20 and not 0x7F <= ord(c) <= 0x9F)
    return cps

CSS_URL = re.compile(r'''(?i)\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))\s*\)''')
CSS_IMPORT = re.compile(r'''(?i)@import\s+(?:"([^"]*)"|'([^']*)')''')

def css_containment(css, where):
    """CSS-level containment: url()/@import may target only data: or #fragment."""
    out = []
    css = strip_css_comments(css)
    for m in CSS_URL.finditer(css):
        target = next((g for g in m.groups() if g is not None), '').strip()
        if target == '' or target.startswith('data:') or target.startswith('#'):
            continue
        out.append(f'CSS url("{target[:80]}") in {where} — only data: and #fragment URLs are allowed')
    for m in CSS_IMPORT.finditer(css):
        target = next((g for g in m.groups() if g is not None), '').strip()
        if target.startswith('data:'):
            continue
        out.append(f'CSS @import "{target[:80]}" in {where} — external stylesheet')
    return out

# ---------- structural marker location ----------
CARD_MARK = re.compile(r'<!-- @dsCard group="([^"]*)" -->')
FONTS_OPEN = re.compile(r'<!-- @dsFonts .*-->')
FONTS_CLOSE = '<!-- /@dsFonts -->'
INLINE_OPEN = re.compile(r'<!-- @dsInline (\S+) -->')
INLINE_CLOSE = '<!-- /@dsInline -->'
HEAD_RE = re.compile(r'(<head[^>]*>(?:<meta charset="[^"]*"\s*/?>)?)')  # --fix injection point

def line_starts_of(lines):
    starts, off = [], 0
    for l in lines:
        starts.append(off)
        off += len(l) + 1
    return starts

def in_script(lineno, spans):
    """lineno 1-based. Spans are (start_tag_line, end_tag_line): content lines
    are strictly between — full-line markers can never share a tag line."""
    return any(s < lineno < e for s, e in spans)

def locate_fonts_blocks(lines, spans, first_script_line):
    """Full-line @dsFonts blocks; marker-shaped text inside <script> content is
    ignored entirely — OPENERS AND CLOSERS alike: a closer candidate inside a
    script span, or at/after the first <script> tag, is never a match (else a
    missing real closer would let --fix splice away script content up to an
    in-script marker-shaped line). Markers must precede the first <script> tag.
    An opener with no legitimate closer is a violation; --fix refuses the card.
    Returns (blocks, problems) — blocks are (open_idx, close_idx) 0-based."""
    blocks, problems = [], []
    for i, l in enumerate(lines):
        if in_script(i + 1, spans):
            continue
        if FONTS_OPEN.fullmatch(l):
            if first_script_line is not None and i + 1 > first_script_line:
                problems.append(('fonts',
                    f'@dsFonts marker on line {i + 1} appears after the first <script> tag '
                    '— the block must precede all scripts'))
                continue
            j = next((k for k in range(i + 1, len(lines))
                      if lines[k] == FONTS_CLOSE
                      and not in_script(k + 1, spans)
                      and (first_script_line is None or k + 1 <= first_script_line)),
                     None)
            if j is None:
                problems.append(('fonts',
                    f'@dsFonts opener on line {i + 1} has no closing `{FONTS_CLOSE}` line '
                    'outside <script> content before the first <script> tag — an opener '
                    'without a legitimate closer is a violation; --fix refuses this card'))
                continue
            blocks.append((i, j))
        elif '<!-- @dsFonts ' in l:
            problems.append(('fonts',
                f'line {i + 1} contains a non-full-line @dsFonts marker — markers must be exact full lines'))
    used_closers = {j for _, j in blocks}
    for i, l in enumerate(lines):
        if (l == FONTS_CLOSE and i not in used_closers
                and not in_script(i + 1, spans)):
            problems.append(('fonts',
                f'stray `{FONTS_CLOSE}` on line {i + 1} without a matching opener'))
    return blocks, problems

def locate_inline_blocks(lines, spans):
    """Full-line @dsInline blocks outside <script> content; marker-shaped text
    inside scripts is ignored entirely. The closing `</script>` + closer pair
    must terminate the block's OWN <script> span (the one the opener's
    `<script>` line starts) — a pair found beyond it would swallow unrelated
    markup/scripts into the payload and let --fix splice them away. An opener
    with no legitimate closer is a violation; --fix refuses the card.
    Returns (blocks, problems) — blocks are
    (open_idx, close_marker_idx, name, payload)."""
    blocks, problems = [], []
    used_closers = set()
    for i, l in enumerate(lines):
        if in_script(i + 1, spans):
            continue
        m = INLINE_OPEN.fullmatch(l)
        if m:
            name = m.group(1)
            if i + 1 >= len(lines) or lines[i + 1] != '<script>':
                problems.append(('inline',
                    f'@dsInline opener on line {i + 1} not followed by a bare `<script>` line'))
                continue
            # the span opened by the `<script>` on line i+2 (1-based)
            e = next((e for s, e in spans if s == i + 2), None)
            if (e is None or e - 1 >= len(lines) or e >= len(lines)
                    or lines[e - 1] != '</script>' or lines[e] != INLINE_CLOSE):
                problems.append(('inline',
                    f'@dsInline opener on line {i + 1} has no closing `</script>` + '
                    f'`{INLINE_CLOSE}` line pair terminating its own <script> block — '
                    'an opener without a legitimate closer is a violation; --fix '
                    'refuses this card'))
                continue
            payload = ''.join(x + '\n' for x in lines[i + 2:e - 1])
            blocks.append((i, e, name, payload))
            used_closers.add(e)
        elif '<!-- @dsInline ' in l:
            problems.append(('inline',
                f'line {i + 1} contains a non-full-line @dsInline marker — markers must be exact full lines'))
    for i, l in enumerate(lines):
        if (l == INLINE_CLOSE and i not in used_closers
                and not in_script(i + 1, spans)):
            problems.append(('inline',
                f'stray `{INLINE_CLOSE}` on line {i + 1} without a matching opener'))
    return blocks, problems

# ---------- manifest authority + fonts block builder ----------
manifest = None
manifest_err = None
if MANIFEST.exists():
    try:
        manifest = json.loads(MANIFEST.read_text())
    except ValueError as e:
        manifest_err = f'unparseable: {e}'
else:
    manifest_err = 'missing'

subset_files_ok = manifest is not None
if manifest is not None:
    for name, meta in manifest.get('files', {}).items():
        p = SUBSET / name
        if not p.exists():
            subset_files_ok = False
            vio(f'assets/fonts/ds-subset/{name}', 'fonts',
                'listed in manifest.json but missing on disk — rerun ./scripts/subset-ds-fonts.sh')
        elif hashlib.sha256(p.read_bytes()).hexdigest() != meta['sha256']:
            subset_files_ok = False
            vio(f'assets/fonts/ds-subset/{name}', 'fonts',
                'sha256 differs from manifest.json — rerun ./scripts/subset-ds-fonts.sh')
    # manifest.json is the sole authority over ds-subset/: nothing extra may live there
    for p in sorted(SUBSET.iterdir()):
        if p.name == 'manifest.json' or p.name in manifest.get('files', {}):
            continue
        vio(f'assets/fonts/ds-subset/{p.name}', 'fonts',
            'not recorded in manifest.json — stale/foreign file; rerun ./scripts/subset-ds-fonts.sh or remove it')
    # the canonical source fonts must still be the ones the subsets came from
    sources = manifest.get('sources')
    if not isinstance(sources, dict) or not sources:
        vio('assets/fonts/ds-subset/manifest.json', 'fonts',
            'manifest records no `sources` (source-font sha256 map) — rerun ./scripts/subset-ds-fonts.sh')
    else:
        for name, sha in sources.items():
            p = CANON_FONTS_DIR / name
            if not p.exists():
                vio(f'(sibling) mythical-design/assets/fonts/{name}', 'fonts',
                    'source font recorded in manifest.json is missing')
            elif hashlib.sha256(p.read_bytes()).hexdigest() != sha:
                vio(f'(sibling) mythical-design/assets/fonts/{name}', 'fonts',
                    'canonical fonts changed — rerun ./scripts/subset-ds-fonts.sh')
else:
    vio('assets/fonts/ds-subset/manifest.json', 'fonts',
        f'{manifest_err} — run ./scripts/subset-ds-fonts.sh first')

# Global font integrity (manifest ↔ ds-subset/ ↔ source fonts). Any violation
# at this level — source-font hash drift, unlisted subset files, missing faces
# — means the canonical font state is untrustworthy: --fix then performs NO
# card writes at all (global integrity first; repairs would embed payloads
# whose provenance is already broken). At this point `violations` holds
# exactly the manifest/source-level findings.
fonts_global_ok = manifest is not None and not violations

def build_fonts_block():
    faces = []
    for name, meta in manifest['files'].items():
        b64 = base64.b64encode((SUBSET / name).read_bytes()).decode()
        faces.append(
            '@font-face{font-family:"%s";src:url("data:font/woff2;base64,%s") '
            'format("woff2");font-weight:%s;font-style:%s;font-display:swap}'
            % (meta['family'], b64, meta['weight'], meta['style']))
    stacks = (':root{--my-font-ui: %s; --my-font-mono: %s}'
              % (canon_light['--my-font-ui'], canon_light['--my-font-mono']))
    digest = hashlib.sha256(
        '\n'.join(sorted(m['sha256'] for m in manifest['files'].values())).encode()
    ).hexdigest()[:16]
    return (f'<!-- @dsFonts sha256={digest} — machine-owned: (re)generated by ./scripts/check-ds.sh --fix '
            'from assets/fonts/ds-subset/ (payloads + coverage: manifest.json; '
            'regenerate subsets with ./scripts/subset-ds-fonts.sh) -->\n'
            f'<style>\n/* ds-subset fonts (mode={manifest.get("mode", "?")}) — embedded so the '
            'self-contained card renders with canonical typography, not host fallbacks */\n'
            + '\n'.join(faces) + '\n' + stacks + '\n</style>\n<!-- /@dsFonts -->')

fonts_block = build_fonts_block() if subset_files_ok else None
manifest_cps = set(manifest.get('codepoints', [])) if manifest else set()
manifest_files = manifest.get('files', {}) if manifest else {}

# ---------- per-card validation ----------
def validate_card(card, text):
    """Complete validation of one card's text. Returns [(category, message)]."""
    out = []
    def v(cat, msg):
        out.append((cat, msg))
    lines = text.split('\n')
    starts = line_starts_of(lines)
    scan = CardScan(line_starts=starts)
    scan.feed(text)
    scan.close()
    spans = scan.script_spans
    first_script_line = (bisect.bisect_right(starts, scan.first_script_off)
                         if scan.first_script_off is not None else None)

    # a. @dsCard marker + group convention
    first = lines[0] if lines else ''
    m = CARD_MARK.fullmatch(first)
    if not m:
        v('marker', f'first line is not `<!-- @dsCard group="…" -->` (got: {first[:60]!r})')
    else:
        group = m.group(1)
        if '-->' in group or any(ord(c) < 0x20 or ord(c) == 0x7F for c in group):
            v('marker', f'group value {group!r} contains `-->` or control characters')
        prefix = card.name.split('-', 1)[0]
        want = GROUP_BY_PREFIX.get(prefix)
        if want is None:
            v('marker', f'filename prefix {prefix!r}-* has no registered group (known: '
              + ', '.join(f'{k}-*→{g}' for k, g in sorted(GROUP_BY_PREFIX.items())) + ')')
        elif group != want:
            v('marker', f'group "{group}" does not match the filename convention '
              f'{prefix}-* → "{want}"')

    # b. self-containment (markup level + CSS level)
    for cat, msg in scan.containment:
        v(cat, msg)
    for kind, css in ([('style-block', s) for s in scan.styles]
                      + [('style-attr', s) for s in scan.inline_styles]):
        for msg in css_containment(css, kind):
            v('containment', msg)

    # c. token identity
    card_css = ([('style-block', s) for s in scan.styles]
                + [('style-attr', s) for s in scan.inline_styles])
    local_my = set()   # every --my-* the card defines itself (any selector)
    for kind, css in card_css:
        decls = (css_my_declarations(css) if kind == 'style-block'
                 else [((), p, val) for _, p, val in css_my_declarations('x{' + css + '}')])
        for stack, prop, value in decls:
            local_my.add(prop)
            dark = any(DARK_SEL.search(s) for s in stack)
            canon = canon_dark if dark else canon_light
            theme = 'dark' if dark else 'light'
            if prop not in canon:
                v('token', f'{prop} defined in card but not in tokens.css ({theme})')
            elif value != canon[prop]:
                v('token',
                  f'{prop} ({theme}): card has `{value}` — canonical is `{canon[prop]}`')

    # c2. token REFERENCES: every var(--my-…) the card's CSS references must
    # resolve against canonical tokens.css (light ∪ dark — canon_dark is that
    # union) ∪ the card's own local definitions. A var() fallback does NOT
    # excuse a dangling reference: `var(--my-x, 10px)` with no --my-x anywhere
    # IS the drift case (token renamed canonically, card left behind).
    # Scope: CSS contexts only — <style> blocks and style="" attributes;
    # script-injected CSS is out of static reach (same documented boundary as
    # runtime-generated glyphs). Non-`--my-*` custom properties are private
    # card vars and out of scope. Identical dangles report once per
    # (context, property, token) — not once per occurrence.
    known_my = set(canon_dark) | local_my
    seen_refs = set()
    for kind, css in card_css:
        src = css if kind == 'style-block' else 'x{' + css + '}'
        for _stack, decls in css_rules(src):
            for prop, value in decls:
                for m in MY_REF.finditer(css_code_only(value)):
                    name = m.group(1)
                    if name in known_my or (kind, prop, name) in seen_refs:
                        continue
                    seen_refs.add((kind, prop, name))
                    v('token', f'var({name}) referenced in `{prop}` ({kind}) '
                      f'but {name} is neither canonical in tokens.css nor '
                      'defined in this card — dangling DS token reference '
                      '(a var() fallback does not excuse it)')

    # d. inline-source identity (structural markers, allowlist-as-REQUIREMENT,
    #    byte identity)
    iblocks, iproblems = locate_inline_blocks(lines, spans)
    for cat, msg in iproblems:
        v(cat, msg)
    allowed = INLINE_ALLOW.get(card.name, set())
    # required-block cardinality: INLINE_ALLOW is a requirement, not a
    # permission — every allowed file must appear in EXACTLY ONE block.
    counts = {}
    for _i, _jc, name, _p in iblocks:
        counts[name] = counts.get(name, 0) + 1
    for name in sorted(allowed):
        n = counts.get(name, 0)
        if n == 0:
            v('inline', f'required @dsInline block for {name} is MISSING — this card '
              'must embed it in exactly one @dsInline block. --fix cannot conjure a '
              'missing block (placement is a human decision): add the marker pair by '
              'hand, then run ./scripts/check-ds.sh --fix to embed the payload')
        elif n > 1:
            v('inline', f'{n} @dsInline blocks for {name} — exactly one is required '
              '(duplicate embeds drift independently)')
    for i, jc, name, payload in iblocks:
        if name not in allowed:
            v('inline', f'@dsInline {name!r} (line {i + 1}) is not allowlisted for this card '
              + (f'(permitted: {", ".join(sorted(allowed))})' if allowed
                 else '(card is not in the @dsInline allowlist)')
              + ' — refused: the wrong source is never embedded')
            continue
        src = REPO_ROOT / name
        if not src.exists():
            v('inline', f'@dsInline references {name}, which does not exist in the repo')
            continue
        src_text = read_text_bytes(src)
        if payload != src_text:
            crlf = payload.replace('\r\n', '\n') == src_text.replace('\r\n', '\n')
            v('inline', f'embedded {name} differs from canonical '
              f'({len(payload)} vs {len(src_text)} chars)'
              + (' — CRLF/LF newline divergence (bytes must match exactly)' if crlf else '')
              + ' — run ./scripts/check-ds.sh --fix')

    # e. fonts
    if manifest:
        fblocks, fproblems = locate_fonts_blocks(lines, spans, first_script_line)
        for cat, msg in fproblems:
            v(cat, msg)
        if len(fblocks) != 1:
            v('fonts', f'{len(fblocks)} well-formed @dsFonts block(s) found, expected exactly 1'
              + ('' if fblocks else ' — run ./scripts/check-ds.sh --fix'))
        elif fonts_block is not None:
            i, j = fblocks[0]
            got = '\n'.join(lines[i:j + 1])
            if got != fonts_block:
                crlf = got.replace('\r\n', '\n') == fonts_block
                v('fonts', 'the @dsFonts block does not byte-match the block regenerated '
                  'from manifest.json + assets/fonts/ds-subset/'
                  + (' — CRLF/LF newline divergence' if crlf else '')
                  + ' — run ./scripts/check-ds.sh --fix')
            open_off = starts[i]
            close_end = starts[j] + len(lines[j])
            if scan.head_open_end is None or scan.head_close_off is None:
                v('fonts', 'card has no <head>…</head> to hold the @dsFonts block')
            elif not (scan.head_open_end <= open_off
                      and close_end <= scan.head_close_off):
                v('fonts', 'the @dsFonts block is not inside <head>…</head>')
            elif scan.charset_end is not None and open_off < scan.charset_end:
                v('fonts', 'the @dsFonts block precedes <meta charset> — it must follow it')
        uncovered = used_codepoints(scan) - manifest_cps
        if uncovered:
            chars = ' '.join(f'U+{c:04X}({chr(c)})' for c in sorted(uncovered))
            v('fonts', f'text uses codepoint(s) outside the subset coverage: {chars} '
              '— rerun ./scripts/subset-ds-fonts.sh, then ./scripts/check-ds.sh --fix. (Static collection '
              'covers markup text + rendered attributes; glyphs produced dynamically at '
              'runtime — String.fromCodePoint etc. — cannot be collected statically: '
              'authors adding exotic dynamic glyphs must rerun the subsetter.)')
        # typography coverage: requested weights/styles vs manifest faces
        local_toks = card_local_tokens(scan.styles)
        reqs, unresolved = font_requests(scan.styles, scan.inline_styles, local_toks)
        for uprop, uraw in unresolved:
            v('fonts', f'{uprop}: `{uraw}` is unresolvable typography — the var() '
              'indirection resolves through neither tokens.css nor the card\'s own '
              ':root/[data-theme] declarations; declare a literal or a card-local token')
        if scan.bold_markup:
            # UA default for <b>/<strong>/<h1>–<h6>/<th>
            reqs.add(('unknown', 'weight', 700.0))
        for fam_class, kind, val in sorted(reqs, key=repr):
            for family in FAMS_FOR[fam_class]:
                if kind == 'weight' and not family_covers_weight(manifest_files, family, val):
                    v('fonts', f'CSS requests font-weight {val:g} ({fam_class}-scope) but the '
                      f'{family} faces in manifest.json cannot cover it — extend the faces / '
                      'rerun ./scripts/subset-ds-fonts.sh')
                if kind == 'italic' and not family_has_italic(manifest_files, family):
                    v('fonts', f'CSS requests font-style italic ({fam_class}-scope) but no '
                      f'italic {family} faces ship in the ds-subset — italics are '
                      'deliberately not subset; no card may use them')
    return out

# ---------- --fix: staged mechanical repair ----------
def repair(card, text):
    """Build the fully repaired card text in memory. Mechanical repairs only:
    re-embed ALLOWLISTED @dsInline sources; regenerate/inject the @dsFonts
    block. Marker-shaped text inside <script> content is never touched."""
    lines = text.split('\n')
    starts = line_starts_of(lines)
    scan = CardScan(line_starts=starts)
    scan.feed(text)
    scan.close()
    spans = scan.script_spans
    first_script_line = (bisect.bisect_right(starts, scan.first_script_off)
                         if scan.first_script_off is not None else None)
    iblocks, _ = locate_inline_blocks(lines, spans)
    fblocks, _ = locate_fonts_blocks(lines, spans, first_script_line)
    allowed = INLINE_ALLOW.get(card.name, set())
    # splice inline blocks bottom-up (indices of earlier lines stay valid; the
    # fonts block always precedes the first <script>, hence every inline block)
    for i, jc, name, payload in sorted(iblocks, reverse=True):
        if name not in allowed:
            continue        # never embed a non-allowlisted source
        src = REPO_ROOT / name
        if not src.exists():
            continue        # validation reports it
        src_text = read_text_bytes(src)
        if payload != src_text:
            lines[i:jc + 1] = (f'<!-- @dsInline {name} -->\n<script>\n'
                               f'{src_text}</script>\n<!-- /@dsInline -->').split('\n')
    if fonts_block is not None and len(fblocks) == 1:
        i, j = fblocks[0]
        if '\n'.join(lines[i:j + 1]) != fonts_block:
            lines[i:j + 1] = fonts_block.split('\n')
    text2 = '\n'.join(lines)
    if fonts_block is not None and not fblocks and HEAD_RE.search(text2):
        text2 = HEAD_RE.sub(lambda m: m.group(1) + '\n' + fonts_block + '\n',
                            text2, count=1)
    return text2

# ---------- per-card ----------
cards = sorted(DS.glob('*.html'))
if not cards:
    vio('ds/', 'structure', 'no ds/*.html cards found')

fixed, refused = [], []
if FIX and not fonts_global_ok:
    print('--fix: manifest/source-level font violations — NO card repairs performed. '
          'Restore global integrity FIRST: 1) rerun ./scripts/subset-ds-fonts.sh (or restore '
          'assets/fonts/ / ds-subset/), 2) then rerun ./scripts/check-ds.sh --fix for the '
          'card repairs.')
for card in cards:
    rel = f'ds/{card.name}'
    text = read_text_bytes(card)
    if FIX and fonts_global_ok:
        new = repair(card, text)
        if new != text:
            staged = validate_card(card, new)
            if staged:
                # staged repair does not validate -> leave the file untouched
                refused.append(rel)
                vio(rel, 'fix', '--fix: staged repair still fails validation — '
                    'card left UNTOUCHED; blocking findings follow')
                for cat, msg in staged:
                    vio(rel, cat, msg)
                continue
            card.write_bytes(new.encode('utf-8'))
            fixed.append(rel)
            continue            # `new` just validated clean
    for cat, msg in validate_card(card, text):
        vio(rel, cat, msg)

# ---------- report ----------
if FIX:
    if fixed:
        print(f'--fix rewrote {len(fixed)} card(s):')
        for f in fixed:
            print(f'  {f}')
    if refused:
        print(f'--fix REFUSED {len(refused)} card(s) (staged repair failed validation):')
        for f in refused:
            print(f'  {f}')
    if not fixed and not refused and fonts_global_ok:
        print('--fix: nothing to rewrite (all mechanical content already current)')
if violations:
    print(f'{len(violations)} violation(s):')
    for v in violations:
        print(f'  {v}')
    raise SystemExit(1)
print(f'check-ds: {len(cards)} cards clean '
      '(marker+group, containment, tokens, inline allowlist+identity, '
      'fonts block+coverage+weights)')
PY
