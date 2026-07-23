/** @jsxImportSource preact */
// @mythicalos/preact-ui — inline banner. tone: warn | info | ok | error. Always carries a glyph +
// text (token rule #7: status softs never rely on color alone).
//
// Ported from design-export's packages/preact-ui/src/components/Banner.jsx (JSX→TSX, typed props).
// The source declared its own tone→class template and a local `GLYPH` map; both now live in
// `@mythicalos/ui-core` as `bannerClass`/`BANNER_ICON` (Task 2, ported verbatim) — this binding
// only renders.

import type { ComponentChildren } from "preact";
import { bannerClass, BANNER_ICON, type BannerTone } from "@mythicalos/ui-core/logic";

export { bannerClass, BANNER_ICON, type BannerTone };

export interface BannerProps {
  tone?: BannerTone;
  glyph?: string;
  action?: ComponentChildren;
  children?: ComponentChildren;
}

export function Banner(props: BannerProps) {
  const { tone = "info", glyph, action, children } = props;
  return (
    <div class={bannerClass(tone)}>
      <span class="my-banner__glyph">{glyph ?? BANNER_ICON[tone]}</span>
      <span>{children}</span>
      {action}
    </div>
  );
}
