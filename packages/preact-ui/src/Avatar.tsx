/** @jsxImportSource preact */
// @mythicalos/preact-ui — circle avatar with initials.
//
// Ported from design-export's packages/preact-ui/src/components/Avatar.jsx (JSX→TSX, typed props).
// A single literal class — no tone/state derivation, nothing to import from ui-core here. (The
// component stylesheet also carries `.my-avatar`/`.my-avatar__ring`/`.my-avatar__inner` for a
// ringed variant the source component never used; this port stays a faithful drop-in of the
// source's plain-initials rendering — see the task report.)

export interface AvatarProps {
  initials: string;
  class?: string;
}

export function Avatar(props: AvatarProps) {
  const { initials, class: cls = "" } = props;
  return <span class={`my-avatar__initials ${cls}`}>{initials}</span>;
}
