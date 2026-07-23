// packages/react-ui/styles.test.tsx — the self-containment render scan (design note §1b-D6),
// adapted for this binding package: THIS package ships NO CSS of its own — the stylesheet lives in
// `@mythicalos/ui-core`. So the scan reads `../ui-core/styles.css` and asserts that every class any
// export's render emits (across its variants, including the 7 new atoms) matches ≥1 selector
// there, and that no export ever emits an inline `style=` attribute (CSP style-src 'self', U18).
//
// React twin of packages/preact-ui/styles.test.tsx — same render matrix, `renderToStaticMarkup`
// instead of `renderToString`.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
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
    out.push(renderToStaticMarkup(<Button variant={v}>Go</Button>));
    out.push(
      renderToStaticMarkup(
        <Button variant={v} small loading>
          Go
        </Button>,
      ),
    );
    out.push(renderToStaticMarkup(<Button variant={v} disabled>Go</Button>));
  }
  out.push(renderToStaticMarkup(<Input label="Name" value="v" help="hint" />));
  out.push(renderToStaticMarkup(<Input value="v" error="bad value" mono dirty />));
  out.push(renderToStaticMarkup(<Input value="v" readOnly disabled />));
  out.push(renderToStaticMarkup(<Toggle on />));
  out.push(renderToStaticMarkup(<Toggle on={false} />));
  out.push(renderToStaticMarkup(<Toggle on disabled />));
  out.push(renderToStaticMarkup(<Checkbox checked label="check" />));
  out.push(renderToStaticMarkup(<Checkbox checked={false} />));
  out.push(renderToStaticMarkup(<Checkbox checked disabled />));
  out.push(renderToStaticMarkup(<MaskedSecretInput label="Key" slot="model/claude" filled masked="sk-…abc" />));
  out.push(renderToStaticMarkup(<MaskedSecretInput label="Key" slot="model/claude" filled={false} entryHint="paste" />));
  for (const s of ["ok", "warn", "error", "info"] as const) {
    out.push(
      renderToStaticMarkup(
        <Toast status={s} title="T" body="b" action={{ label: "undo", onAction: noop }} onClose={noop} />,
      ),
    );
  }
  out.push(
    renderToStaticMarkup(
      <ToastProvider>
        <span>app</span>
      </ToastProvider>,
    ),
  );
  out.push(
    renderToStaticMarkup(
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
  out.push(renderToStaticMarkup(<ConfirmDialog title="T" body="b" confirmLabel="Do" onConfirm={noop} onCancel={noop} />));
  out.push(
    renderToStaticMarkup(
      <ConfirmDialog title="T" body="b" confirmLabel="Do" requireName="model/claude" onConfirm={noop} onCancel={noop} />,
    ),
  );
  for (const v of ["unconfigured", "asleep", "neutral"] as const) {
    out.push(renderToStaticMarkup(<EmptyState variant={v} title="T" body="b" actions={<Button>Go</Button>} />));
  }

  // ── the 7 new atoms (Task 6) ──
  for (const t of ["neutral", "accent", "ok", "warn", "error", "info"] as const) {
    out.push(renderToStaticMarkup(<Chip tone={t}>tag</Chip>));
  }
  out.push(renderToStaticMarkup(<Card title="Eyebrow">body</Card>));
  out.push(renderToStaticMarkup(<Card flush>rows</Card>));
  out.push(renderToStaticMarkup(<Avatar initials="HS" />));
  for (const t of ["ok", "warn", "error", "info", "muted", "accent"] as const) {
    out.push(renderToStaticMarkup(<StatusLine tone={t}>state</StatusLine>));
  }
  out.push(renderToStaticMarkup(<SearchInput value="" placeholder="Search…" />));
  out.push(renderToStaticMarkup(<SearchInput value="abc" onClear={noop} />));
  for (const t of ["warn", "info", "ok", "error"] as const) {
    out.push(renderToStaticMarkup(<Banner tone={t}>message</Banner>));
  }
  out.push(renderToStaticMarkup(<Gauge pct={42} />));
  out.push(renderToStaticMarkup(<Gauge pct={80} showLabel={false} />));
  out.push(renderToStaticMarkup(<Gauge pct={95} />));
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

describe("self-containment — every emitted class resolves in ui-core's styles.css (adapted from r2-F6)", () => {
  const renders = allRenders();
  const emitted = new Set<string>();
  for (const html of renders) {
    for (const m of html.matchAll(/class="([^"]*)"/g)) {
      for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
    }
  }

  test("renders emit a real class surface", () => {
    expect(emitted.size).toBeGreaterThan(20);
    // the §1a-8 spine classes are package-owned (shipped from ui-core) — prove the markup emits them
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
