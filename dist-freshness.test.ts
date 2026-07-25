// dist-freshness.test.ts — a workspace-level guard against testing a STALE BUILD.
//
// Every package here resolves its public entry through an `exports` map that points at
// `dist/`, never `src/`. `dist/` is gitignored. So a cross-package test — shell rendering
// preact-ui's Input, say — exercises whatever was last built, which in a long-lived or
// freshly-cloned checkout can be months behind `src/`.
//
// That is not hypothetical: it produced three failures that read exactly like a real
// regression in a sibling package, and the misdiagnosis outlived several rounds of
// investigation. The build was simply old. `bun run test` could chain a build, but the
// failure mode arrives through a bare `bun test`, which bypasses scripts entirely — so the
// guard has to live inside the suite itself.
//
// The check is structural rather than timestamp-based: mtimes are noisy across clones,
// checkouts and worktrees, whereas a name that `src/index.ts` exports and `dist/index.js`
// does not is unambiguous evidence that the build predates the source.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = join(import.meta.dir, "packages");

/** Top-level export names declared by a package's `src/index.ts`, ignoring type-only names
 * (they are erased at build time and legitimately absent from the emitted JS). */
function declaredExports(indexSrc: string): string[] {
  const names = new Set<string>();
  for (const m of indexSrc.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const raw of (m[1] ?? "").split(",")) {
      const spec = raw.trim();
      if (!spec || spec.startsWith("type ")) continue;
      const local = spec.split(/\s+as\s+/)[0]?.trim() ?? "";
      if (/^[A-Za-z_$][\w$]*$/.test(local)) names.add(local);
    }
  }
  for (const m of indexSrc.matchAll(/^export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => existsSync(join(PACKAGES_DIR, name, "src", "index.ts")));

describe("built output is not stale", () => {
  for (const pkg of packages) {
    const dir = join(PACKAGES_DIR, pkg);
    const distIndex = join(dir, "dist", "index.js");

    test(`${pkg} — dist/ exists (run \`bun run build\`)`, () => {
      expect(
        existsSync(distIndex),
        `${pkg}/dist/index.js is missing. Consumers resolve this package through its exports ` +
          `map to dist/, so the suite would be testing nothing. Run \`bun run build\`.`,
      ).toBe(true);
    });

    test(`${pkg} — dist/ exports everything src/ declares`, () => {
      if (!existsSync(distIndex)) return; // the test above already reported this
      const declared = declaredExports(readFileSync(join(dir, "src", "index.ts"), "utf8"));
      const built = readFileSync(distIndex, "utf8");
      // The emitted barrel re-exports by name, so a declared name absent from the built
      // entry means the build predates the source.
      const missing = declared.filter((n) => !new RegExp(`\\b${n}\\b`).test(built));
      expect(
        missing,
        `${pkg}/dist is STALE — src/index.ts exports ${missing.join(", ")}, the built entry ` +
          `does not. Anything importing this package is testing an old build. Run \`bun run build\`.`,
      ).toEqual([]);
    });
  }
});
