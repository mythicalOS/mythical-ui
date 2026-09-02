// test/agnostic.test.ts — the package's whole reason to exist: @mythicalos/ui-core holds the pure
// logic BOTH a Preact binding and a React binding import, so it must never depend on either
// framework's runtime. This scans every file under src/ (not just the ones this task authored) so
// a future addition can't reintroduce a `preact`/`react` import unnoticed.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const srcDir = join(import.meta.dir, "..", "src");
const files = collectFiles(srcDir);

describe("agnostic guard — zero preact/react imports anywhere under src/", () => {
  test("src/ is non-empty (the scan itself is meaningful)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test('no file imports from "preact" or "react"', () => {
    const offenders: { file: string; line: string }[] = [];
    const bannedPattern = /from\s+["']((preact)|(react))(\/[^"']*)?["']/;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const line of src.split("\n")) {
        if (bannedPattern.test(line)) {
          offenders.push({ file, line: line.trim() });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('no file has a require("preact") / require("react") either (defensive, covers non-ESM callers)', () => {
    const offenders: { file: string; line: string }[] = [];
    const bannedRequire = /require\(\s*["']((preact)|(react))(\/[^"']*)?["']\s*\)/;
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const line of src.split("\n")) {
        if (bannedRequire.test(line)) offenders.push({ file, line: line.trim() });
      }
    }
    expect(offenders).toEqual([]);
  });
});
