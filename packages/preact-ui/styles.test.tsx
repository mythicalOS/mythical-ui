/** @jsxImportSource preact */
// packages/preact-ui/styles.test.tsx — the self-containment render scan (design note §1b-D6),
// adapted for this binding package: THIS package ships NO CSS of its own — the stylesheet moved to
// `@mythicalos/ui-core` in Task 3. So the scan reads `../ui-core/styles.css` and asserts that every
// class any export's render emits (across its variants, including the 7 new atoms this task adds)
// matches ≥1 selector there, and that no export ever emits an inline `style=` attribute (CSP
// style-src 'self', U18).
//
// The token-only / hex-literal / declared-custom-property / toast-border scans that
// mythical-skuld's own styles.test.tsx also ran are CSS-CONTENT checks against a file this package
// doesn't own or ship — that coverage lives in ui-core's own test/css.test.ts now and is not
// duplicated here.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmDialog,
  EmptyState,
  Gauge,
  Input,
  MaskedSecretInput,
  SearchInput,
  StatusLine,
  Toast,
  ToastProvider,
  Toggle,
} from "./src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");

const noop = () => {};

/** Every export, rendered across its prop/state variants. */
function allRenders(): string[] {
  const out: string[] = [];
  for (const v of ["pri", "acc", "sec", "gho", "dan"] as const) {
    out.push(renderToString(<Button variant={v}>Go</Button>));
    out.push(
      renderToString(
        <Button variant={v} small loading>
          Go
        </Button>,
      ),
    );
    out.push(renderToString(<Button variant={v} disabled>Go</Button>));
  }
  out.push(renderToString(<Input label="Name" value="v" help="hint" />));
  out.push(renderToString(<Input value="v" error="bad value" mono dirty />));
  out.push(renderToString(<Input value="v" readOnly disabled />));
  out.push(renderToString(<Toggle on />));
  out.push(renderToString(<Toggle on={false} />));
  out.push(renderToString(<Toggle on disabled />));
  out.push(renderToString(<Checkbox checked label="check" />));
  out.push(renderToString(<Checkbox checked={false} />));
  out.push(renderToString(<Checkbox checked disabled />));
  out.push(renderToString(<MaskedSecretInput label="Key" slot="model/claude" filled masked="sk-…abc" />));
  out.push(renderToString(<MaskedSecretInput label="Key" slot="model/claude" filled={false} entryHint="paste" />));
  for (const s of ["ok", "warn", "error", "info"] as const) {
    out.push(
      renderToString(
        <Toast status={s} title="T" body="b" action={{ label: "undo", onAction: noop }} onClose={noop} />,
      ),
    );
  }
  out.push(
    renderToString(
      <ToastProvider>
        <span>app</span>
      </ToastProvider>,
    ),
  );
  out.push(
    renderToString(
      <ConfirmDialog
        title="Delete this?"
        body="really"
        bullets={[
          { tone: "ok", text: "kept" },
          { tone: "warn", text: "changed" },
          { tone: "error", text: "lost" },
        ]}
        confirmLabel="Delete"
        loading
        onConfirm={noop}
        onCancel={noop}
      />,
    ),
  );
  out.push(renderToString(<ConfirmDialog title="T" body="b" confirmLabel="Do" onConfirm={noop} onCancel={noop} />));
  out.push(
    renderToString(
      <ConfirmDialog title="T" body="b" confirmLabel="Do" requireName="model/claude" onConfirm={noop} onCancel={noop} />,
    ),
  );
  for (const v of ["unconfigured", "asleep", "neutral"] as const) {
    out.push(renderToString(<EmptyState variant={v} title="T" body="b" actions={<Button>Go</Button>} />));
  }

  // ── the 7 new atoms (Task 6) ──
  for (const t of ["neutral", "accent", "ok", "warn", "error", "info"] as const) {
    out.push(renderToString(<Chip tone={t}>tag</Chip>));
  }
  out.push(renderToString(<Card title="Eyebrow">body</Card>));
  out.push(renderToString(<Card flush>rows</Card>));
  out.push(renderToString(<Avatar initials="HS" />));
  for (const t of ["ok", "warn", "error", "info", "muted", "accent"] as const) {
    out.push(renderToString(<StatusLine tone={t}>state</StatusLine>));
  }
  out.push(renderToString(<SearchInput value="" placeholder="Search…" />));
  out.push(renderToString(<SearchInput value="abc" onClear={noop} />));
  for (const t of ["warn", "info", "ok", "error"] as const) {
    out.push(renderToString(<Banner tone={t}>message</Banner>));
  }
  out.push(renderToString(<Gauge pct={42} />));
  out.push(renderToString(<Gauge pct={80} showLabel={false} />));
  out.push(renderToString(<Gauge pct={95} />));
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("self-containment — every emitted class resolves in ui-core's styles.css (Task 6, adapted from r2-F6)", () => {
  const renders = allRenders();
  const emitted = new Set<string>();
  for (const html of renders) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
    }
  }

  test("renders emit a real class surface", () => {
    expect(emitted.size).toBeGreaterThan(20);
    // the §1a-8 spine classes are package-owned (now shipped from ui-core) — prove the markup emits them
    for (const c of ["spine-track", "spine-dash", "spine-node", "spine-dot", "spine-here"]) {
      expect(emitted.has(c)).toBe(true);
    }
    // the 7 new atoms' base classes
    for (const c of ["my-chip", "my-status", "my-card", "my-avatar__initials", "my-search", "my-banner", "my-gauge"]) {
      expect(emitted.has(c)).toBe(true);
    }
  });

  test("each emitted class matches ≥1 selector in ui-core's styles.css", () => {
    const missing = [...emitted].filter((c) => !new RegExp(`\\.${escapeRe(c)}(?![\\w-])`).test(css));
    expect(missing).toEqual([]);
  });

  test("no export ever emits an inline style attribute (CSP style-src 'self')", () => {
    for (const html of renders) expect(html).not.toContain("style=");
  });
});
