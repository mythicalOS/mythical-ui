// styles-structure.test.ts (package-local) — ui-core's OWN pre-publish structural gate.
//
// `packages/ui-core/package.json` declares `prepublishOnly: bun run build && bun test && …`, and
// that `bun test` runs from the PACKAGE directory, where Bun never discovers the workspace-root
// guard. A direct `npm publish` from here would otherwise sail straight past it. The assertions
// live in scripts/css-publish-gate.ts so this file and shell's twin cannot drift; only the sheet
// discovery is local, because only this package knows what it ships.
//
// The defect this closes, for the record: `.my-pop-trigger:focus-visible` lost its closing `}` in
// 843254a, so every rule after it in the published sheet — and every consumer rule concatenated
// after that downstream — parsed as nested inside it and silently never applied.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { registerCssPublishGate, type PublishedSheet } from "../../../scripts/css-publish-gate";

const PKG = join(import.meta.dir, "..");

const sheets: PublishedSheet[] = [{ id: "styles.css", src: readFileSync(join(PKG, "styles.css"), "utf8") }];

// The <mythical-select> sheet lives inside a JS template literal in a shipped file (`src/select`
// is in this package's `files`). A browser parses it as CSS, so it gets the same walk. Bounded
// exactly the way the component and select-parses.test.ts bound it: `:host{` to the closing
// backtick.
const selectJs = join(PKG, "src", "select", "mythical-select.js");
if (existsSync(selectJs)) {
  const source = readFileSync(selectJs, "utf8");
  const start = source.indexOf(":host{");
  if (start === -1) throw new Error(`${selectJs}: could not locate the embedded sheet (no ':host{')`);
  const end = source.indexOf("`", start);
  sheets.push({
    id: "src/select/mythical-select.js (embedded stylesheet)",
    src: source.slice(start, end === -1 ? undefined : end),
  });
}

registerCssPublishGate("@mythicalos/ui-core", sheets, "styles.css");
