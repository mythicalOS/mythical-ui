/** @jsxImportSource preact */
// @mythicalos/shell — settings surface: a 260px left nav beside a scrolling detail pane. Mirrors
// the workspace split but tuned for settings sections.
//   <SettingsLayout nav={<SettingsNav .../>}> …active section… </SettingsLayout>
//
// Ported from design-export's mythical-ui/src/components/Settings.jsx (JSX→TSX, typed props).

import type { ComponentChildren } from "preact";

export interface SettingsLayoutProps {
  nav?: ComponentChildren;
  children?: ComponentChildren;
}

export function SettingsLayout({ nav, children }: SettingsLayoutProps) {
  return (
    <div class="my-split">
      {nav}
      <div class="my-settings__detail">{children}</div>
    </div>
  );
}

export interface SettingsNavItem {
  key: string;
  label: string;
}

export interface SettingsNavProps {
  items: SettingsNavItem[];
  active?: string;
  onSelect?: (key: string) => void;
  footer?: ComponentChildren;
}

/** Vertical section nav. `items` = [{ key, label }]. `active` is the current key. */
export function SettingsNav({ items, active, onSelect, footer }: SettingsNavProps) {
  return (
    <nav class="my-settings__nav">
      {items.map((it) => (
        <button
          key={it.key}
          class={"my-settings__item" + (it.key === active ? " is-active" : "")}
          onClick={() => onSelect?.(it.key)}
        >
          {it.label}
        </button>
      ))}
      {footer}
    </nav>
  );
}
