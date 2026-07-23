// @mythicalos/react-ui — inline banner. tone: warn | info | ok | error. Always carries a glyph +
// text (token rule #7: status softs never rely on color alone).
//
// React twin of packages/preact-ui/src/Banner.tsx. `bannerClass`/`BANNER_ICON` (tone→class + glyph
// derivation) are imported from `@mythicalos/ui-core`, never reimplemented — this binding only
// renders.

import type { ReactNode } from "react";
import { bannerClass, BANNER_ICON, type BannerTone } from "@mythicalos/ui-core/logic";

export { bannerClass, BANNER_ICON, type BannerTone };

export interface BannerProps {
  tone?: BannerTone;
  glyph?: string;
  action?: ReactNode;
  children?: ReactNode;
}

export function Banner(props: BannerProps) {
  const { tone = "info", glyph, action, children } = props;
  return (
    <div className={bannerClass(tone)}>
      <span className="my-banner__glyph">{glyph ?? BANNER_ICON[tone]}</span>
      <span>{children}</span>
      {action}
    </div>
  );
}
