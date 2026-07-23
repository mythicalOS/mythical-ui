/** @jsxImportSource preact */
// packages/preact-ui/masked-secret.test.tsx — the U13 masked-secret entry contract
// (diff r1-F10, S1a-11): the ENTRY control renders type="password" with
// autocomplete="new-password" — a replacement credential is never displayed as plaintext while
// typed, and the browser never offers to save/fill it. The filled state stays a readonly mask.
//
// Ported verbatim from the family's internal Preact atoms package (masked-secret.test.tsx).

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import { MaskedSecretInput } from "./src/index.ts";

describe("MaskedSecretInput — masked ENTRY (U13, diff r1-F10)", () => {
  test("the empty-slot entry control is type=password + autocomplete=new-password", () => {
    const html = renderToString(<MaskedSecretInput label="Key" slot="model/claude" filled={false} entryHint="paste" />);
    expect(html).toContain('type="password"');
    expect(html).toContain('autocomplete="new-password"');
    expect(html).not.toContain('type="text"');
  });
  test("the filled state renders the readonly mask, never the entry control", () => {
    const html = renderToString(<MaskedSecretInput label="Key" slot="model/claude" filled masked="sk-…abc" />);
    expect(html).toContain("sk-…abc");
    expect(html).toContain("readonly");
    expect(html).not.toContain('type="password"'); // no entry lane until Replace
  });
});
