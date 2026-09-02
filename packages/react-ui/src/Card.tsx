// @mythicalos/react-ui — Card container. `title` renders the uppercase eyebrow header. `flush`
// removes padding for row/table lists that draw their own dividers.
//
// React twin of packages/preact-ui/src/Card.tsx. No tone/state derivation here — `flush` is a
// literal boolean modifier (ui-core has no `cardClass` module), same as the Preact sibling.
//
// Preact→React prop delta: `class` → `className` (see Chip.tsx's note — same rename, same reason).

import type { ReactNode } from "react";

export interface CardProps {
  title?: string;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}

export function Card(props: CardProps) {
  const { title, flush = false, className: cls = "", children } = props;
  return (
    <section className={`my-card${flush ? " my-card--flush" : ""} ${cls}`}>
      {title ? <h3 className="my-card__title">{title}</h3> : null}
      {children}
    </section>
  );
}
