/** @jsxImportSource preact */
// @mythicalos/shell — the WIRED theme control: @mythicalos/preact-ui's theme-toggle family bound
// to `useThemeMode`, so a product drops one element into its chrome instead of rolling a ☾ button
// and its own persistence.
//
//   <TopBar.Right>
//     <StatusLine tone="ok">container up</StatusLine>
//     <ThemeControl />                       {/* segmented, System first-class — the bar default */}
//   </TopBar.Right>
//
// Placement per the card's in-situ panel: last item in the top bar's right cluster — theme is the
// least-urgent control on the bar. Use `member="icon"` when the cluster is already crowded
// (narrow viewports, ≤960): a single 30px button that skips System. The labelled segmented
// variant belongs in a settings row, not the bar.
//
// The underlying members stay CONTROLLED and stateless (see preact-ui's ThemeToggle); this
// component is exactly the binding: `useThemeMode` owns the persisted mode, the media-query
// resolution, and the `data-theme` reflection.

import { ThemeToggle, ThemeToggleIcon, type ThemeMode } from "@mythicalos/preact-ui";
import { useThemeMode, type UseThemeOptions } from "./hooks/useTheme.js";

export interface ThemeControlProps extends UseThemeOptions {
  /** Which family member to render. `segmented` (the default) is the three-mode radiogroup with
   *  System first-class; `icon` is the compact top-bar member — it has no System, so clicking it
   *  always sets an explicit mode. */
  member?: "segmented" | "icon";
  /** Segmented member only: the labelled variant (each option shows its word) — settings rows. */
  labelled?: boolean;
  /** Icon member only: the bordered standalone/toolbar variant. */
  bordered?: boolean;
  /** The mode used before the user has ever chosen one. `system` per the card. */
  defaultMode?: ThemeMode;
  class?: string;
}

export function ThemeControl(props: ThemeControlProps) {
  const { member = "segmented", labelled, bordered, defaultMode = "system", storageKey } = props;
  const { mode, setMode, isDark } = useThemeMode(defaultMode, { storageKey });
  if (member === "icon") {
    return (
      <ThemeToggleIcon isDark={isDark} onToggle={setMode} bordered={bordered} class={props.class} />
    );
  }
  return <ThemeToggle mode={mode} onModeChange={setMode} labelled={labelled} class={props.class} />;
}
