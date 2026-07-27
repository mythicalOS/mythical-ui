// styles-structure.test.ts (package-local) — shell's OWN pre-publish structural gate.
//
// `package.json` declares `prepublishOnly: bun run build && bun test && …`, and that `bun test`
// runs from the PACKAGE directory, where Bun never discovers the workspace-root guard. A direct
// `npm publish` from here would otherwise sail straight past it. Found by the codex gate while
// closing the same hole in ui-core: shell publishes `styles.css` too, so a half-closed gate would
// have left this package free to ship the very defect the gate exists for.
//
// That risk is not theoretical for this sheet in particular: consumers CONCATENATE it into one
// served stylesheet, so an unclosed rule here silently swallows every rule after it — including
// the consumer's own overlays. That is exactly how ui-core 0.3.2 blanked a product's unlock
// screen. The assertions live in scripts/css-publish-gate.ts, shared with ui-core's twin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registerCssPublishGate, type PublishedSheet } from "../../scripts/css-publish-gate";

const sheets: PublishedSheet[] = [
  { id: "styles.css", src: readFileSync(join(import.meta.dir, "styles.css"), "utf8") },
];

registerCssPublishGate("@mythicalos/shell", sheets, "styles.css");
