// packages/react-ui/masked-secret.test.tsx — the U13 masked-secret entry contract
// (diff r1-F10, S1a-11): the ENTRY control renders type="password" with
// autocomplete="new-password" — a replacement credential is never displayed as plaintext while
// typed, and the browser never offers to save/fill it. The filled state stays a readonly mask.
//
// React twin of packages/preact-ui/masked-secret.test.tsx — same assertions,
// `renderToStaticMarkup` instead of `renderToString`. One casing delta: React's SSR string output
// keeps `autoComplete`/etc. in their JSX camelCase spelling rather than lowercasing to the raw HTML
// attribute name (unlike `className`→`class` or the SVG stroke-* attributes, which it does
// translate) — browsers parse HTML attribute names case-insensitively, so `autoComplete="…"` and
// `autocomplete="…"` are equivalent to the DOM/password-manager; only the literal test string
// changes, not the behavior.

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MaskedSecretInput } from "./src/index.ts";

describe("MaskedSecretInput — masked ENTRY (U13, diff r1-F10)", () => {
  test("the empty-slot entry control is type=password + autoComplete=new-password", () => {
    const html = renderToStaticMarkup(<MaskedSecretInput label="Key" slot="model/claude" filled={false} entryHint="paste" />);
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain('type="text"');
  });
  test("the filled state renders the readonly mask, never the entry control", () => {
    const html = renderToStaticMarkup(<MaskedSecretInput label="Key" slot="model/claude" filled masked="sk-…abc" />);
    expect(html).toContain("sk-…abc");
    expect(html).toContain("readonly");
    expect(html).not.toContain('type="password"'); // no entry lane until Replace
  });
});
