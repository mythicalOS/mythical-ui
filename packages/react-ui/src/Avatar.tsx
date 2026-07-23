// @mythicalos/react-ui — circle avatar with initials.
//
// React twin of packages/preact-ui/src/Avatar.tsx. A single literal class — no tone/state
// derivation, nothing to import from ui-core here.
//
// Preact→React prop delta: `class` → `className` (see Chip.tsx's note — same rename, same reason).

export interface AvatarProps {
  initials: string;
  className?: string;
}

export function Avatar(props: AvatarProps) {
  const { initials, className: cls = "" } = props;
  return <span className={`my-avatar__initials ${cls}`}>{initials}</span>;
}
