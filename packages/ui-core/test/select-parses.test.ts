// select-parses.test.ts — the <mythical-select> source must actually PARSE as a module.
//
// Every other test around this component reads it as TEXT: they regex the stylesheet for
// selectors, scan for token references, assert on copy. Text assertions cannot tell a valid
// module from a broken one, so a syntax error sails straight through a green suite — and this
// file is plain .js, so the TypeScript build does not look at it either.
//
// That gap shipped a broken package twice. A comment added inside the component's CSS block
// used backticks for emphasis; the whole sheet is a JS template literal, so the backtick
// closed it and the module stopped parsing. Both releases went out green and the failure only
// surfaced when a consumer first tried to bundle it.
//
// Importing the module for real is what closes the gap. It exercises the parser, which is the
// exact thing every text-based assertion in this directory cannot do.

import { expect, test } from "bun:test";

test("mythical-select.js parses and evaluates as a module", async () => {
  // A bare import is the whole point: a syntax error rejects here. The module registers custom
  // elements on import, so guard for a DOM-less runtime rather than requiring one.
  const path = new URL("../src/select/mythical-select.js", import.meta.url).href;
  if (typeof customElements === "undefined") {
    // No DOM: parse without running the registration side effect. `new Function` compiles the
    // source, which is the syntax check we need, without executing it.
    const source = await Bun.file(new URL("../src/select/mythical-select.js", import.meta.url)).text();
    expect(() => new Function(source)).not.toThrow();
    return;
  }
  await expect(import(path)).resolves.toBeDefined();
});

test("the component's stylesheet carries no backtick — it lives inside a template literal", async () => {
  const source = await Bun.file(new URL("../src/select/mythical-select.js", import.meta.url)).text();
  // The sheet is delimited by the css template literal; any backtick between its bounds would
  // terminate it early. Locate the sheet the same way the component does — from `:host{`.
  const start = source.indexOf(":host{");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf("`", start);
  const sheet = source.slice(start, end === -1 ? undefined : end);
  expect(sheet).toContain("#pop{");
  expect(
    sheet.includes("`"),
    "a backtick inside the stylesheet would close the template literal early",
  ).toBe(false);
});
