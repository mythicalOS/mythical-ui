// css-structure.ts — the structural walk over a stylesheet, shared by the workspace-root guard
// (styles-structure.test.ts) and by each package's own pre-publish guard.
//
// It lives OUTSIDE any test file on purpose: packages/*/package.json runs `bun test` from the
// PACKAGE directory in its prepublishOnly hook, and a package-local run does not discover a
// workspace-root test file. A direct `npm publish` from a package would therefore have shipped
// past the root guard entirely (codex gate, HIGH). Both callers import this module instead.


export type Anomaly = { kind: string; line: number; detail: string };

/** A `{` that is currently open, and how it was introduced. */
export type OpenBlock = { line: number; prelude: string; isAtRule: boolean };

function short(s: string, n = 80): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
}

/**
 * Walk a stylesheet once and report every structural anomaly found, in source order.
 * Returns [] for a well-formed sheet.
 */
export function scanStylesheet(src: string): Anomaly[] {
  const out: Anomaly[] = [];
  const stack: OpenBlock[] = [];
  let i = 0;
  let line = 1;
  // Text since the last `{`, `}` or `;` seen in the NORMAL state — i.e. a selector or an
  // at-rule head. Comments, strings and url(…) spans each contribute a single space instead of
  // their content, so a prelude never contains comment or string text and needs no second pass.
  let prelude = "";
  let preludeLine = 1;

  const push = (kind: string, at: number, detail: string) => out.push({ kind, line: at, detail });

  while (i < src.length) {
    const c = src[i]!;
    const two = src.slice(i, i + 2);

    // ── comment ──────────────────────────────────────────────────────────────────────────
    if (two === "/*") {
      const openedAt = line;
      const openIdx = i;
      i += 2;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "\n") line++;
        if (src.slice(i, i + 2) === "*/") {
          i += 2;
          closed = true;
          break;
        }
        // CSS comments do not nest, so an opener inside one is always a mistake — it means a
        // `*/` went missing upstream and this comment has swallowed the sheet from there.
        if (src.slice(i, i + 2) === "/*") {
          push("opener inside a comment", line, short(src.slice(openIdx, i + 2).slice(-160)));
          i += 2;
          continue;
        }
        i++;
      }
      if (!closed) {
        push(
          "unterminated comment",
          openedAt,
          `opened at line ${openedAt} and never closed — the rest of the sheet is inside it: ${short(src.slice(openIdx, openIdx + 160))}`,
        );
      }
      prelude += " ";
      continue;
    }

    // A terminator with no comment open means the matching `/*` was lost upstream of it — the
    // 6c50c90 signature exactly.
    if (two === "*/") {
      push("terminator outside a comment", line, short(src.slice(Math.max(0, i - 160), i + 2)));
      i += 2;
      continue;
    }

    // ── string ───────────────────────────────────────────────────────────────────────────
    if (c === '"' || c === "'") {
      const quote = c;
      const openedAt = line;
      i++;
      let closed = false;
      while (i < src.length) {
        if (src[i] === "\\") {
          if (src[i + 1] === "\n") line++;
          i += 2;
          continue;
        }
        // A raw newline inside a string is invalid CSS: the string was never closed. Stop here
        // rather than swallowing the rest of the sheet, which is what a browser also does.
        if (src[i] === "\n") break;
        if (src[i] === quote) {
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (!closed) {
        push(
          "unterminated string",
          openedAt,
          `a ${quote === '"' ? "double" : "single"} quote opened at line ${openedAt} is never closed on that line`,
        );
      }
      prelude += " ";
      continue;
    }

    // ── url(…) — opaque, so an unquoted data URI's braces/semicolons are not counted ──────
    if (src.slice(i, i + 4).toLowerCase() === "url(") {
      const openedAt = line;
      i += 4;
      let depthParen = 1;
      while (i < src.length && depthParen > 0) {
        const ch = src[i]!;
        if (ch === "\n") line++;
        if (ch === "\\") {
          i += 2;
          continue;
        }
        if (ch === '"' || ch === "'") {
          const q = ch;
          const quoteLine = line;
          i++;
          let quoteClosed = false;
          while (i < src.length) {
            if (src[i] === q) { quoteClosed = true; break; }
            // A raw newline terminates a CSS string. Bailing here without SAYING so let a
            // malformed `url("x<newline>);` look sound, because the outer paren loop then
            // accepted the later `)` (codex gate). A string that never closes is an anomaly.
            if (src[i] === "\n") break;
            if (src[i] === "\\") i++;
            i++;
          }
          if (!quoteClosed) {
            push("unterminated string in url()", quoteLine, short(src.slice(Math.max(0, i - 60), i + 20)));
          }
        } else if (ch === "(") depthParen++;
        else if (ch === ")") depthParen--;
        i++;
      }
      // Treating url(…) as opaque is what stops a data URI's braces being miscounted — but it
      // also means an unclosed `url(` would swallow the rest of the sheet SILENTLY, which is the
      // exact failure mode this whole file exists to prevent. So say so instead.
      if (depthParen > 0) {
        push(
          "unterminated url(",
          openedAt,
          `a url( opened at line ${openedAt} has no closing ')' — everything after it is being ` +
            `read as part of the URL, by this guard and by a browser alike.`,
        );
      }
      prelude += " ";
      continue;
    }

    // ── structure ────────────────────────────────────────────────────────────────────────
    if (c === "{") {
      const text = prelude.trim();
      const isAtRule = text.startsWith("@");
      // A plain style rule may only open at top level, or inside at-rule blocks (@media,
      // @supports, @layer, @container). A style rule opening inside ANOTHER style rule means an
      // earlier `}` was lost — and that is the case brace COUNTING cannot see, because a stray
      // `}` elsewhere rebalances the file while leaving the rules permanently nested.
      const enclosingStyleRule = stack.find((b) => !b.isAtRule);
      if (!isAtRule && enclosingStyleRule) {
        push(
          "rule nested inside a rule",
          line,
          `\`${short(text, 60)}\` opens inside the block \`${short(enclosingStyleRule.prelude, 60)}\` ` +
            `opened at line ${enclosingStyleRule.line}. Either that rule is missing its \`}\`, or the sheet ` +
            `has started using CSS nesting (it did not before — if that is intentional, this guard needs updating).`,
        );
      }
      stack.push({ line, prelude: text || "(empty)", isAtRule });
      prelude = "";
      preludeLine = line;
      i++;
      continue;
    }

    if (c === "}") {
      if (stack.length === 0) {
        push("closing brace with no open block", line, short(prelude || src.slice(Math.max(0, i - 120), i + 1)));
      } else {
        stack.pop();
      }
      prelude = "";
      preludeLine = line;
      i++;
      continue;
    }

    if (c === ";") {
      const text = prelude.trim();
      // A declaration outside every block. At top level CSS admits only at-statements
      // (`@import …;`, `@charset …;`), so anything else here is prose or an orphaned
      // declaration — the tail of the 6c50c90 failure, and what a lost `}` leaves behind once a
      // stray `}` has closed the block early.
      if (stack.length === 0 && text && !text.startsWith("@")) {
        push(
          "declaration outside any rule",
          preludeLine,
          `\`${short(text, 80)}\` sits at top level — it belongs to no selector and does nothing.`,
        );
      }
      prelude = "";
      preludeLine = line;
      i++;
      continue;
    }

    if (c === "\n") {
      line++;
      if (!prelude.trim()) preludeLine = line;
    }
    prelude += c;
    i++;
  }

  // Anything still open at EOF has swallowed the tail of the sheet — and, for a package whose
  // stylesheet a consumer CONCATENATES, everything appended after it as well.
  for (const b of stack) {
    push(
      "unclosed block at end of file",
      b.line,
      `\`${short(b.prelude, 60)}\` opened at line ${b.line} and is never closed. Every rule after it — ` +
        `including anything a consumer concatenates onto this sheet — is trapped inside it and never applies.`,
    );
  }

  return out;
}

/**
 * Count comment delimiters that a CSS parser would actually treat as delimiters — i.e. skipping
 * string and `url(…)` spans, where `/*` and `*` + `/` are ordinary characters.
 *
 * A raw `src.match(/\/\*​/g)` count (what the guard this replaced used) fails on perfectly valid
 * CSS: `.x::before { content: "/*"; }` is sound, `scanStylesheet` accepts it, and a raw count
 * reports 1 opener against 0 terminators — blocking a legitimate release. Found by the codex gate.
 *
 * Kept alongside the walk rather than folded into it: the walk reports the FIRST anomaly of each
 * kind in order, while a count still catches a pathological pair of mistakes that cancel out in
 * the state machine yet leave the sheet wrong.
 */
export function countCommentDelimiters(src: string): { opens: number; closes: number } {
  let opens = 0;
  let closes = 0;
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      opens++;
      i += 2;
      while (i < src.length) {
        if (src.slice(i, i + 2) === "*/") {
          closes++;
          i += 2;
          break;
        }
        // CSS comments do not nest; an opener here means an upstream `*/` went missing. Count it
        // so the totals still describe what the file contains.
        if (src.slice(i, i + 2) === "/*") {
          opens++;
          i += 2;
          continue;
        }
        i++;
      }
      continue;
    }
    if (src[i] === '"' || src[i] === "'") {
      const quote = src[i]!;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++; // an escaped char cannot terminate the string
        i++;
      }
      i++;
      continue;
    }
    // url(…) — opaque either way, but the two forms need different scanning. An UNQUOTED
    // argument (a data: URI, say) can legitimately carry `/*`; a QUOTED one can additionally
    // carry the closing `)` itself, so stopping at the first `)` would resume mid-string and
    // miscount whatever follows. Found by the codex gate: `URL("x)/*")` is valid CSS that the
    // naive version rejected as an unclosed comment, blocking a legitimate release.
    if (src.slice(i, i + 4).toLowerCase() === "url(") {
      i += 4;
      while (i < src.length && (src[i] === " " || src[i] === "\t" || src[i] === "\n")) i++;
      if (src[i] === '"' || src[i] === "'") {
        const quote = src[i]!;
        i++;
        while (i < src.length && src[i] !== quote) {
          if (src[i] === "\\") i++;
          i++;
        }
        i++; // past the closing quote
      }
      while (i < src.length && src[i] !== ")") i++;
      i++;
      continue;
    }
    i++;
  }
  return { opens, closes };
}
