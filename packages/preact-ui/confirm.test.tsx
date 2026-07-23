/** @jsxImportSource preact */
// packages/preact-ui/confirm.test.tsx — the generic ConfirmDialog contract (design note §1b-D21):
// a typed-name-match danger confirm with NEUTRAL prop names (no mythical "lifecycle" vocabulary).
// Without `requireName` it is a plain danger confirm (confirm enabled); with `requireName` the
// danger action stays disabled until the operator types the exact name (rules-of-use 9 — the
// skuld secrets delete consumes exactly this). The match logic is the pure `typedNameMatches`,
// now imported (not reimplemented) from `@mythicalos/ui-core`.
//
// Ported verbatim from mythical-skuld's packages/preact-ui/confirm.test.tsx.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import { ConfirmDialog, typedNameMatches } from "./src/index.ts";

const noop = () => {};

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

describe("ConfirmDialog — render contract", () => {
  test("plain danger confirm: confirm button enabled, Esc/safe-action copy present", () => {
    const html = renderToString(<ConfirmDialog title="Delete job?" body="really" confirmLabel="Delete" onConfirm={noop} onCancel={noop} />);
    expect(html).toContain("Delete job?");
    expect(html).toContain("danf");
    expect(html).not.toContain("disabled");
    expect(html).toContain("Esc cancels");
  });
  test("typed-name mode: confirm disabled until the name is typed; the required name is shown", () => {
    const html = renderToString(
      <ConfirmDialog title="Delete secret?" body="perm" confirmLabel="Delete" requireName="model/claude" onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toContain("model/claude");
    expect(html).toContain("disabled");
    expect(html).toMatch(/<input[^>]*class="[^"]*input[^"]*"/);
  });
  test("bullets render with their tone icons", () => {
    const html = renderToString(
      <ConfirmDialog
        title="T"
        body="b"
        bullets={[{ tone: "warn", text: "changes things" }]}
        confirmLabel="Do"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(html).toContain("changes things");
    expect(html).toContain("ic-warn");
  });
  test("no mythical lifecycle vocabulary anywhere in the rendered markup", () => {
    const html = renderToString(<ConfirmDialog title="T" body="b" confirmLabel="Do" onConfirm={noop} onCancel={noop} />);
    expect(html.toLowerCase()).not.toContain("lifecycle");
    expect(html.toLowerCase()).not.toContain("recreate");
  });
});
