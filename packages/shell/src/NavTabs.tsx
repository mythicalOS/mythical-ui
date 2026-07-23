/** @jsxImportSource preact */
// @mythicalos/shell — primary navigation tabs.
//
// Ported from design-export's mythical-ui/src/components/NavTabs.jsx (JSX→TSX, typed props).

export interface NavTabItem {
  key: string;
  label: string;
}

export interface NavTabsProps {
  items: NavTabItem[];
  active?: string;
  onSelect?: (key: string) => void;
}

/** `items` = [{ key, label }]. `active` is the key of the current tab; `onSelect(key)` fires on
 * click. */
export function NavTabs({ items, active, onSelect }: NavTabsProps) {
  return (
    <nav class="my-nav">
      {items.map((it) => (
        <button
          key={it.key}
          class={"my-nav__tab" + (it.key === active ? " is-active" : "")}
          onClick={() => onSelect?.(it.key)}
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
