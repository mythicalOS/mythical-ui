// test/logic/dialog.test.ts — ported from mythical-skuld's packages/preact-ui/confirm.test.tsx, the
// `typedNameMatches` describe block only (the `ConfirmDialog`/`Scrim` render-contract tests in that
// file exercise a Preact JSX renderer, which stays in the Preact binding package — out of scope here).

import { describe, expect, test } from "bun:test";
import { typedNameMatches } from "../../src/logic/dialog.ts";

describe("typedNameMatches — the pure typed-name gate", () => {
  test("no requireName ⇒ always enabled", () => {
    expect(typedNameMatches(undefined, "")).toBe(true);
    expect(typedNameMatches(undefined, "anything")).toBe(true);
  });
  test("requireName ⇒ enabled ONLY on the exact (trimmed) match", () => {
    expect(typedNameMatches("model/claude", "")).toBe(false);
    expect(typedNameMatches("model/claude", "model/clau")).toBe(false);
    expect(typedNameMatches("model/claude", "model/claude")).toBe(true);
    expect(typedNameMatches("model/claude", "  model/claude  ")).toBe(true);
    expect(typedNameMatches("model/claude", "MODEL/CLAUDE")).toBe(false);
  });
});
