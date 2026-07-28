// @mythicalos/shell — theme provider hook. Persists to localStorage and reflects onto
// <html data-theme="…">, which flips every design token (see mythical-design's tokens.css).
// 'light' is the default; 'dark' is the heritage/terminal theme.
//
// Ported from the design source's useTheme hook, EXTENDED with a `storageKey` option: the export
// hard-coded the localStorage key as `mythical:theme`, but a product that shipped before this
// package existed may already persist its users' choice under a different key (BROKKR uses
// `mythical.ui.theme`) — a silent key rename on install would reset every existing user's theme
// back to the default. `storageKey` defaults to the export's original `mythical:theme`
// (unchanged behavior for a fresh consumer) and lets any such product pass its own instead.

import { useCallback, useEffect, useState } from "preact/hooks";
import { isThemeMode, resolveThemeIsDark, type ThemeMode } from "@mythicalos/preact-ui";

export type Theme = "light" | "dark";
export type { ThemeMode };

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

// ── the three-mode hook (ds/components-theme-toggle) ────────────────────────────────────────────
//
// `useThemeMode` is the state owner the theme-toggle family was designed against: the mode
// (`system | light | dark`, System first-class) is what persists, and the resolved light/dark is
// derived — `resolveThemeIsDark(mode, systemPrefersDark)` from the core, with a live
// `prefers-color-scheme` listener while the mode is `system`.
//
// It deliberately shares `DEFAULT_THEME_STORAGE_KEY` (and the `storageKey` option) with the binary
// `useTheme` above, because the stored vocabulary is a superset: an existing user's persisted
// "light"/"dark" carries over as the same EXPLICIT mode (which is what choosing it in the old UI
// meant), and a persisted "system" read by the old binary hook is simply ignored (it falls back to
// its default) rather than misread. The old hook stays exactly as it is — a consumer that wants
// only light/dark keeps it; a consumer adopting the toggle family moves to this one.

export interface UseThemeModeResult {
  /** The mode in force — what persists, and what the segmented control renders. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** The RESOLVED theme (`system` already collapsed against the OS preference). */
  theme: Theme;
  /** Same resolution as `theme`, in the shape the icon member consumes. */
  isDark: boolean;
}

function readStoredMode(key: string): ThemeMode | undefined {
  // try/catch around the ACCESS too: in a sandboxed/opaque-origin frame, touching
  // `localStorage` at all throws SecurityError — that must mean "no stored mode",
  // not a component that cannot render. (The binary useTheme above shares this
  // latent exposure; its behavior is frozen for compatibility, so it is unchanged.)
  try {
    if (typeof localStorage === "undefined") return undefined;
    const saved = localStorage.getItem(key);
    return isThemeMode(saved) ? saved : undefined;
  } catch {
    return undefined;
  }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function queryPrefersDark(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia(DARK_QUERY).matches;
}

export function useThemeMode(
  defaultMode: ThemeMode = "system",
  opts: UseThemeOptions = {},
): UseThemeModeResult {
  const storageKey = opts.storageKey ?? DEFAULT_THEME_STORAGE_KEY;
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode(storageKey) ?? defaultMode);
  const [, bumpSystemPreference] = useState(0);

  // The OS preference is probed LIVE at render, never cached in state — caching it would go
  // stale while an explicit mode has the listener detached, and the first render back in
  // `system` mode would then reflect the wrong theme for a frame.
  const systemPrefersDarkNow = queryPrefersDark();

  // This effect exists only to TRIGGER a re-render when the preference changes, and only while
  // the mode is `system` — an explicit mode ignores the media query (resolveThemeIsDark does),
  // so there is nothing to listen for. After attaching, it re-checks against the value the
  // render just used: a change that lands in the gap between the render-time probe and the
  // listener attach fires no event, so it would otherwise stay reflected until something else
  // re-rendered. The probed value is deliberately in the deps — each bump re-runs the effect
  // with a fresh closure, and the re-check converges (probe === matches ⇒ no further bump).
  useEffect(() => {
    if (mode !== "system" || typeof matchMedia === "undefined") return;
    const mq = matchMedia(DARK_QUERY);
    const onChange = () => bumpSystemPreference((n) => n + 1);
    mq.addEventListener("change", onChange);
    if (mq.matches !== systemPrefersDarkNow) bumpSystemPreference((n) => n + 1);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, systemPrefersDarkNow]);

  const isDark = resolveThemeIsDark(mode, systemPrefersDarkNow);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    try {
      localStorage.setItem(storageKey, mode);
    } catch {
      // storage unavailable (private mode, quota, SSR) — theme still applies for this session
    }
  }, [mode, isDark, storageKey]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);

  return { mode, setMode, theme: isDark ? "dark" : "light", isDark };
}
