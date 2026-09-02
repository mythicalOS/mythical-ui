/** @jsxImportSource preact */
// @mythicalos/preact-ui — Card container. `title` renders the uppercase eyebrow header. `flush`
// removes padding for row/table lists that draw their own dividers.
//
// Ported from design-export's packages/preact-ui/src/components/Card.jsx (JSX→TSX, typed props).
// No tone/state derivation here — `flush` is a literal boolean modifier (ui-core has no `cardClass`
// module; there is no branchy logic to import), the same structural-class category as the wrapper
// `<div>`s elsewhere in this package.

import type { ComponentChildren } from "preact";

export interface CardProps {
  title?: string;
  flush?: boolean;
  class?: string;
  children?: ComponentChildren;
}

export function Card(props: CardProps) {
  const { title, flush = false, class: cls = "", children } = props;
  return (
    <section class={`my-card${flush ? " my-card--flush" : ""} ${cls}`}>
      {title ? <h3 class="my-card__title">{title}</h3> : null}
      {children}
    </section>
  );
}
