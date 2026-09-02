/** @jsxImportSource preact */
// packages/shell/theme-control.test.tsx — useThemeMode + ThemeControl render contract.
//
// Same depth note as use-theme.test.ts: this bun:test environment has no DOM globals
// (`document`, `window`, `localStorage`, `matchMedia` are all undefined). So:
//   • The hooks' READ half (both lazy useState initializers — the stored mode and the initial
//     media-query probe) runs under plain preact-render-to-string; the storage-keyed lookup is
//     exercised through the same minimal in-memory localStorage shim use-theme.test.ts installs,
//     scoped to the describe blocks that need it.
//   • With no `matchMedia`, the initial systemPrefersDark probe is `false` by the guard — which
//     pins the SSR contract: `system` resolves LIGHT wherever the OS preference is unknowable.
//   • The WRITE half (the `data-theme` reflection effect, mode persistence, and the
//     `prefers-color-scheme` change listener) never runs under SSR and needs globals this
//     environment lacks; it is verified by source scan, the package's established technique for
//     un-mockable wiring (see use-theme.test.ts's depth note).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  DEFAULT_THEME_STORAGE_KEY,
  ThemeControl,
  useThemeMode,
  type ThemeMode,
} from "./src/index.ts";

function ModeProbe(props: { defaultMode?: ThemeMode; storageKey?: string }) {
  const { mode, theme, isDark } = useThemeMode(
    props.defaultMode,
    props.storageKey ? { storageKey: props.storageKey } : undefined,
  );
  return <span data-mode={mode} data-theme-result={theme} data-is-dark={String(isDark)} />;
}

interface StorageShim {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function installStorage(entries: Record<string, string>): void {
  const map = new Map(Object.entries(entries));
  const shim: StorageShim = {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
  (globalThis as Record<string, unknown>).localStorage = shim;
}

function removeStorage(): void {
  delete (globalThis as Record<string, unknown>).localStorage;
}

describe("useThemeMode — initial value (SSR, no storage available)", () => {
  test("defaults to system, which resolves LIGHT when the OS preference is unknowable", () => {
    const html = renderToString(<ModeProbe />);
    expect(html).toContain('data-mode="system"');
    expect(html).toContain('data-theme-result="light"');
    expect(html).toContain('data-is-dark="false"');
  });

  test("an explicit defaultMode is honored and resolved", () => {
    const html = renderToString(<ModeProbe defaultMode="dark" />);
    expect(html).toContain('data-mode="dark"');
    expect(html).toContain('data-is-dark="true"');
  });
});

describe("useThemeMode — stored-mode lookup (localStorage shim)", () => {
  afterEach(removeStorage);

  test("a persisted mode under the default key wins over defaultMode — including 'system'", () => {
    installStorage({ [DEFAULT_THEME_STORAGE_KEY]: "system" });
    const html = renderToString(<ModeProbe defaultMode="dark" />);
    expect(html).toContain('data-mode="system"');
  });

  test("a LEGACY binary value persisted by useTheme carries over as the same explicit mode", () => {
    installStorage({ [DEFAULT_THEME_STORAGE_KEY]: "dark" });
    const html = renderToString(<ModeProbe />);
    expect(html).toContain('data-mode="dark"');
    expect(html).toContain('data-theme-result="dark"');
  });

  test("garbage in storage is ignored, not misread", () => {
    installStorage({ [DEFAULT_THEME_STORAGE_KEY]: "solarized" });
    const html = renderToString(<ModeProbe />);
    expect(html).toContain('data-mode="system"');
  });

  test("storageKey is threaded through the lookup, same contract as useTheme", () => {
    installStorage({ "mythical.ui.theme": "dark", [DEFAULT_THEME_STORAGE_KEY]: "light" });
    const html = renderToString(<ModeProbe storageKey="mythical.ui.theme" />);
    expect(html).toContain('data-mode="dark"');
  });
});

describe("ThemeControl — the wired binding (SSR render)", () => {
  afterEach(removeStorage);

  test("default member is the segmented radiogroup with the resolved mode checked", () => {
    installStorage({ [DEFAULT_THEME_STORAGE_KEY]: "light" });
    const html = renderToString(<ThemeControl />);
    expect(html).toContain('role="radiogroup"');
    // Exactly one option checked, and it is Light.
    const checked = html.match(/aria-checked="true"/g) ?? [];
    expect(checked.length).toBe(1);
    expect(html).toMatch(/aria-label="Light"[^>]*aria-checked="true"|aria-checked="true"[^>]*aria-label="Light"/);
  });

  test("member='icon' renders the icon member with aria-pressed from the RESOLVED theme", () => {
    installStorage({ [DEFAULT_THEME_STORAGE_KEY]: "dark" });
    const html = renderToString(<ThemeControl member="icon" />);
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('role="radiogroup"');
  });

  test("labelled variant shows the words; plain segmented does not", () => {
    const labelled = renderToString(<ThemeControl labelled />);
    expect(labelled).toContain(">System<");
    const plain = renderToString(<ThemeControl />);
    expect(plain).not.toContain(">System<");
  });
});

describe("useThemeMode — the write half and the media-query listener (source scan)", () => {
  const source = readFileSync(join(import.meta.dir, "src/hooks/useTheme.ts"), "utf8");

  test("the reflection effect writes the RESOLVED theme to data-theme and persists the MODE", () => {
    expect(source).toContain('setAttribute("data-theme", isDark ? "dark" : "light")');
    expect(source).toContain("localStorage.setItem(storageKey, mode)");
  });

  test("the prefers-color-scheme listener is added only in system mode, and removed on cleanup", () => {
    expect(source).toContain('if (mode !== "system" || typeof matchMedia === "undefined") return;');
    expect(source).toContain('mq.addEventListener("change", onChange)');
    expect(source).toContain('mq.removeEventListener("change", onChange)');
  });

  test("resolution goes through the core's resolveThemeIsDark, probing the OS preference LIVE", () => {
    expect(source).toContain("const systemPrefersDarkNow = queryPrefersDark();");
    expect(source).toContain("resolveThemeIsDark(mode, systemPrefersDarkNow)");
    expect(source).not.toContain('mode === "dark" ||');
  });

  test("the attach-gap re-check exists: a preference change that beat the listener still lands", () => {
    expect(source).toContain("if (mq.matches !== systemPrefersDarkNow) bumpSystemPreference");
    expect(source).toContain("[mode, systemPrefersDarkNow]");
  });

  test("the stored-mode read cannot throw out of the initializer (sandboxed-frame storage)", () => {
    const fn = source.slice(source.indexOf("function readStoredMode"), source.indexOf("const DARK_QUERY"));
    expect(fn).toContain("try {");
    expect(fn).toContain("return undefined;");
  });
});
