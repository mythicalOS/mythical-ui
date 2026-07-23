// @mythicalos/shell — theme provider hook. Persists to localStorage and reflects onto
// <html data-theme="…">, which flips every design token (see mythical-design's tokens.css).
// 'light' is the default; 'dark' is the heritage/terminal theme.
//
// Ported from design-export's mythical-ui/src/hooks/useTheme.js, EXTENDED with a `storageKey`
// option (Task 8): the export hard-coded the localStorage key as `mythical:theme`, but BROKKR's
// existing production app already persists under `mythical.ui.theme` (see
// BROKKR's internal ui/src/state/theme.ts's THEME_STORAGE_KEY) — a silent key rename on install
// would reset every existing user's theme choice back to the default. `storageKey` defaults to
// the export's original `mythical:theme` (unchanged behavior for a fresh consumer) but lets
// BROKKR (and any product with a pre-existing key) pass its own so installs don't lose state.

import { useCallback, useEffect, useState } from "preact/hooks";

export type Theme = "light" | "dark";

export const DEFAULT_THEME_STORAGE_KEY = "mythical:theme";

export interface UseThemeOptions {
  /** localStorage key to persist under. Defaults to the export's original `mythical:theme`. */
  storageKey?: string;
}

export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

function readStored(key: string): Theme | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const saved = localStorage.getItem(key);
  if (saved === "light" || saved === "dark") return saved;
  return undefined;
}

export function useTheme(defaultTheme: Theme = "light", opts: UseThemeOptions = {}): UseThemeResult {
  const storageKey = opts.storageKey ?? DEFAULT_THEME_STORAGE_KEY;
  const [theme, setThemeState] = useState<Theme>(() => readStored(storageKey) ?? defaultTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // storage unavailable (private mode, quota, SSR) — theme still applies for this session
    }
  }, [theme, storageKey]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return { theme, setTheme, toggle };
}
