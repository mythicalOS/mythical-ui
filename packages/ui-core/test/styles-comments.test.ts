// styles-comments.test.ts — the shipped stylesheet's comments must be well-formed.
//
// This sheet is assembled from one banner-delimited section per component, and consumers
// concatenate it into their own served CSS. A single dropped `/*` therefore does not fail
// loudly: the prose that was meant to be a comment becomes garbage declarations, a browser
// discards tokens until it recovers, and the first real rule after the banner can vanish with
// it. Nothing in a class-name or token assertion notices, because the class names are all
// still present in the file.
//
// It happened here: resolving a rebase conflict between two sections silently dropped one
// banner's opening `/*`, and the sheet shipped with 134 openers against 135 terminators. The
// consumer's own CSS guard caught it — this package had no equivalent, so the defect reached
// a published version first.

import { expect, test } from "bun:test";

const SHEET = new URL("../styles.css", import.meta.url);

/** Walk the sheet once, tracking comment state, and report the first anomaly. */
function firstCommentAnomaly(src: string): { kind: string; index: number; context: string } | null {
  let i = 0;
  let inComment = false;
  let openedAt = -1;
  while (i < src.length - 1) {
    const two = src.slice(i, i + 2);
    if (!inComment && two === "/*") {
      inComment = true;
      openedAt = i;
      i += 2;
      continue;
    }
    if (inComment && two === "*/") {
      inComment = false;
      i += 2;
      continue;
    }
    // A terminator outside a comment means an opener was lost upstream of it.
    if (!inComment && two === "*/") {
      return { kind: "terminator outside a comment", index: i, context: src.slice(Math.max(0, i - 200), i + 2) };
    }
    // CSS comments do not nest, so an opener inside one is always a mistake.
    if (inComment && two === "/*") {
      return { kind: "opener inside a comment", index: i, context: src.slice(openedAt, i + 2).slice(-200) };
    }
    i += 1;
  }
  return inComment ? { kind: "unterminated comment", index: openedAt, context: src.slice(openedAt, openedAt + 200) } : null;
}

test("every comment in styles.css opens and closes exactly once", async () => {
  const src = await Bun.file(SHEET).text();
  const anomaly = firstCommentAnomaly(src);
  expect(
    anomaly,
    anomaly ? `${anomaly.kind} at offset ${anomaly.index}:\n…${anomaly.context}` : "",
  ).toBeNull();
});

test("openers and terminators are balanced in count", async () => {
  const src = await Bun.file(SHEET).text();
  const opens = (src.match(/\/\*/g) ?? []).length;
  const closes = (src.match(/\*\//g) ?? []).length;
  expect(opens, `${opens} openers vs ${closes} terminators — a banner lost its /*`).toBe(closes);
});
