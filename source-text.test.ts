// source-text.test.ts
//
// Every tracked source file must be TEXT: valid UTF-8, with no NUL byte.
//
// WHY THIS EXISTS, and it is not hypothetical. `packages/ui-core/src/logic/file-explorer.ts`
// carried a raw NUL for months — a deliberate separator in a synthetic row id
// (`${id}<NUL>depth`), chosen precisely because a NUL cannot occur in a real path. The intent was
// sound; the encoding was not. Nothing about it was visible: the file compiled, the suite passed,
// `tsc` was clean, and every editor rendered the NUL as whitespace.
//
// What it broke was searchability. Many grep builds — and any wrapper that injects `-I` — classify
// a file containing a NUL as binary and skip it outright: no match, no notice, exit 1. Output and
// exit status agree with each other and both say "no match", which is indistinguishable from the
// file genuinely not containing the term. So the file becomes invisible to every completeness,
// orphan, or absence check that does not pass `-a` — while still looking perfectly ordinary to a
// human reading it.
//
// The fix was not to abandon the separator but to spell it: `\u0000` in the source produces the
// identical runtime character while leaving the file greppable. That is the rule this test pins.
//
// The honest description of this gate's value is narrow: it makes no code correct. It makes every
// source file greppable, which is the precondition for anyone — human or tool — being able to
// check that the code is correct.
//
// Scope is `git ls-files` rather than a directory walk, so it follows what is actually committed
// and cannot be fooled by build output or an untracked scratch file. Binary assets are excluded by
// extension, explicitly, so adding one is a deliberate act rather than a silent widening.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Extensions whose contents are legitimately not text. Deliberately short. */
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".pdf",
  ".zip",
  ".gz",
  ".zst",
]);

const repoRoot = import.meta.dir;

function trackedFiles(): string[] {
  const proc = Bun.spawnSync({
    cmd: ["git", "ls-files", "-z"],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${new TextDecoder().decode(proc.stderr)}`);
  }
  return new TextDecoder()
    .decode(proc.stdout)
    .split("\0")
    .filter((p) => p.length > 0);
}

function isTextCandidate(path: string): boolean {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return true; // extensionless tracked files here are scripts/configs
  return !BINARY_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

describe("tracked source files are text", () => {
  test("the file list is real — the harness is not silently checking nothing", () => {
    // Without this, every assertion below passes vacuously the day `git ls-files` returns empty
    // (a moved cwd, a broken git). The suite must not be able to report a clean sweep of zero files.
    const files = trackedFiles().filter(isTextCandidate);
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain("packages/ui-core/src/logic/file-explorer.ts");
    expect(files).toContain("package.json");
  });

  test("no tracked source file contains a NUL byte", () => {
    // A NUL makes many greps skip the file entirely — no output, no notice, no-match exit status —
    // so it becomes invisible to every search that does not pass `-a`, while still compiling,
    // still passing, and still diffing as text. That combination is what makes it dangerous.
    // Need the character at runtime? Write it as the escape `\u0000`, never as a literal byte.
    const offenders: string[] = [];
    for (const rel of trackedFiles().filter(isTextCandidate)) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(join(repoRoot, rel));
      } catch {
        continue; // a tracked path missing from the working tree is not this test's business
      }
      const at = bytes.indexOf(0);
      if (at >= 0) {
        const lineNumber = bytes.subarray(0, at).toString("utf8").split("\n").length;
        offenders.push(`${rel}:${lineNumber} (byte offset ${at})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("every tracked source file decodes as UTF-8", () => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const offenders: string[] = [];
    for (const rel of trackedFiles().filter(isTextCandidate)) {
      let bytes: Buffer;
      try {
        bytes = readFileSync(join(repoRoot, rel));
      } catch {
        continue;
      }
      try {
        decoder.decode(bytes);
      } catch (err) {
        offenders.push(`${rel}: ${(err as Error).message}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
