// packages/shell/use-theme.test.ts — useTheme render contract (Task 8): storageKey default and
// override.
//
// Depth note: this bun:test environment has no DOM globals at all — `typeof document`,
// `typeof window`, and `typeof localStorage` are all "undefined" here (verified directly below;
// this is a plain bun:test run, no jsdom/happy-dom configured). Two consequences:
//   1. The hook's *read* half (`readStored`, which seeds the initial `useState` value via a lazy
//      initializer) DOES run under a plain preact-render-to-string render — no effect or mount
//      required. To exercise the actual storageKey-keyed lookup (rather than only "no
//      localStorage ⇒ always falls back to defaultTheme", which would be trivially true in this
//      environment regardless of storageKey), this file installs a minimal in-memory
//      `globalThis.localStorage` shim for its own describe block only — just
//      getItem/setItem/removeItem backed by a plain Map. This is NOT jsdom and does not simulate
//      `document`/`window`/a node tree; it is the smallest possible substitute for the one Web
//      Storage API the hook touches, installed and torn down around exactly the tests that need
//      it so the rest of this file (and other files in this package) still run DOM-free.
//   2. The hook's *write* half (the `useEffect` that calls
//      `document.documentElement.setAttribute("data-theme", …)` and persists via
//      `localStorage.setItem`) never runs at all under preact-render-to-string (SSR never
//      executes effects) and separately needs `document`, which this environment doesn't have
//      even with the localStorage shim installed. That half is verified by a source scan instead
//      — the same technique packages/preact-ui/hooks.test.ts uses for usePoll's un-mockable timer
//      wiring — proving the effect threads the resolved `storageKey` variable through
//      `localStorage.setItem` (rather than the export's original hard-coded `"mythical:theme"`
//      literal), sets `data-theme`, and that `toggle` flips light/dark.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { h, type FunctionComponent } from "preact";
import { renderToString } from "preact-render-to-string";
import { DEFAULT_THEME_STORAGE_KEY, useTheme, type Theme } from "./src/index.ts";

interface TestConsumerProps {
  defaultTheme?: Theme;
  storageKey?: string;
}

const TestConsumer: FunctionComponent<TestConsumerProps> = (props) => {
  const { theme } = useTheme(props.defaultTheme, props.storageKey ? { storageKey: props.storageKey } : undefined);
  return h("span", { "data-theme-result": theme }, theme);
};

function renderConsumer(props: TestConsumerProps): string {
  return renderToString(h(TestConsumer, props));
}

describe("useTheme — DEFAULT_THEME_STORAGE_KEY", () => {
  test("this environment genuinely has no DOM globals (sanity for the depth note above)", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
    expect(typeof localStorage).toBe("undefined");
  });

  test("defaults to the export's original key, unchanged — a fresh install keeps working exactly as before", () => {
    expect(DEFAULT_THEME_STORAGE_KEY).toBe("mythical:theme");
  });
});

describe("useTheme — initial value (the lazy useState initializer; runs under SSR, no effect needed)", () => {
  test("no localStorage available ⇒ falls back to the given defaultTheme", () => {
    const html = renderConsumer({ defaultTheme: "dark" });
    expect(html).toContain(">dark<");
  });

  test("no defaultTheme given ⇒ 'light'", () => {
    const html = renderConsumer({});
    expect(html).toContain(">light<");
  });
});

describe("useTheme — storageKey default vs. override (minimal in-memory localStorage shim — see depth note)", () => {
  const store = new Map<string, string>();
  const shim: Storage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  };

  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: Storage }).localStorage = shim;
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  test("reads the DEFAULT key when no storageKey option is given", () => {
    store.set(DEFAULT_THEME_STORAGE_KEY, "dark");
    const html = renderConsumer({ defaultTheme: "light" });
    expect(html).toContain(">dark<"); // the stored value wins over the passed defaultTheme
  });

  test("reads the CALLER's storageKey, not the default, when one is given", () => {
    store.set("mythical.ui.theme", "dark"); // e.g. BROKKR's existing production key
    store.set(DEFAULT_THEME_STORAGE_KEY, "light"); // decoy under the default key
    const html = renderConsumer({ defaultTheme: "light", storageKey: "mythical.ui.theme" });
    expect(html).toContain(">dark<");
  });

  test("an unset custom storageKey falls back to defaultTheme, never the default key's value", () => {
    store.set(DEFAULT_THEME_STORAGE_KEY, "dark"); // must NOT be consulted once storageKey is set
    const html = renderConsumer({ defaultTheme: "light", storageKey: "some.other.key" });
    expect(html).toContain(">light<");
  });

  test("an invalid stored value is ignored, falling back to defaultTheme", () => {
    store.set(DEFAULT_THEME_STORAGE_KEY, "not-a-theme");
    const html = renderConsumer({ defaultTheme: "dark" });
    expect(html).toContain(">dark<");
  });
});

describe("useTheme — source scan: the persist effect threads storageKey and toggle flips light/dark", () => {
  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }
  const src = stripComments(readFileSync(join(import.meta.dir, "src", "hooks", "useTheme.ts"), "utf8"));

  test("the persist effect sets document.documentElement's data-theme attribute", () => {
    expect(src).toContain('document.documentElement.setAttribute("data-theme", theme)');
  });

  test("the persist effect writes to localStorage using the resolved storageKey variable, not a re-hard-coded literal", () => {
    expect(src).toContain("localStorage.setItem(storageKey, theme)");
    expect(src).not.toContain('localStorage.setItem("mythical:theme"');
  });

  test("storageKey resolves from opts, defaulting to DEFAULT_THEME_STORAGE_KEY (not a second separate literal)", () => {
    expect(src).toContain("opts.storageKey ?? DEFAULT_THEME_STORAGE_KEY");
  });

  test("toggle flips dark<->light", () => {
    expect(src).toMatch(/t === "dark" \? "light" : "dark"/);
  });
});
