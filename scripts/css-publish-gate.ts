// css-publish-gate.ts — the per-package pre-publish structural gate, defined once.
//
// WHY PER-PACKAGE AT ALL (codex gate, HIGH ×2): each package's `prepublishOnly` runs `bun test`
// from the PACKAGE directory, and Bun only discovers test files beneath the directory it is
// invoked in. The workspace-root guard (styles-structure.test.ts) therefore never runs on that
// path, so a direct `npm publish` from a package would ship past it entirely. Every package that
// publishes CSS calls this from its own `test/` directory.
//
// The root guard still owns BREADTH — it walks every package's sheets, proves discovery matched
// what the manifests declare, and proves the walk catches each historical defect. This owns the
// publish gate. Both call the same scanner, so the two cannot drift.
import { describe, expect, test } from "bun:test";
import { countCommentDelimiters, scanStylesheet } from "./css-structure";

export type PublishedSheet = { id: string; src: string };

/**
 * Register the gate for one package's published stylesheets.
 *
 * `required` names a sheet that MUST be present — without it a package whose discovery silently
 * returned nothing would report green while checking nothing at all.
 */
export function registerCssPublishGate(pkgName: string, sheets: PublishedSheet[], required: string): void {
  describe(`${pkgName}'s published stylesheets are structurally intact (pre-publish gate)`, () => {
    test("the walk actually found this package's sheets", () => {
      expect(
        sheets.map((s) => s.id),
        `no published stylesheet was discovered — this gate would pass vacuously`,
      ).toContain(required);
    });

    for (const { id, src } of sheets) {
      test(`${id} — braces, comments and nesting are sound`, () => {
        const anomalies = scanStylesheet(src);
        const report = anomalies
          .slice(0, 5)
          .map((a) => `  line ${a.line}: ${a.kind}\n    ${a.detail}`)
          .join("\n");
        expect(
          anomalies.map((a) => `line ${a.line}: ${a.kind}`),
          anomalies.length
            ? `${id} is structurally broken (${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}; ` +
              `first ${Math.min(5, anomalies.length)} shown — FIX THE FIRST ONE, the rest usually cascade):\n${report}`
            : "",
        ).toEqual([]);
      });

      // Kept from 6c50c90's comment guard: the walk reports the first anomaly of each kind in
      // order, while a count still catches a pathological pair that cancels in the state machine
      // but leaves the sheet wrong. String/url-aware — a raw regex count fails on the valid
      // `content: "/*"`.
      test(`${id} — comment openers and terminators balance in count`, () => {
        const { opens, closes } = countCommentDelimiters(src);
        expect(opens, `${opens} openers vs ${closes} terminators — a banner lost its /* or its */`).toBe(closes);
      });
    }
  });
}
