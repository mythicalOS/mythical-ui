/** @jsxImportSource preact */
// @mythicalos/shell — top bar shell (family furniture). Compose the product's chrome into it:
//   <TopBar>
//     <ProductSwitcher current="brokkr" />
//     <NavTabs items={…} active={…} onSelect={…} />
//     <TopBar.Right>
//       <StatusLine tone="ok">engine ok</StatusLine>   {/* StatusLine is from @mythicalos/preact-ui */}
//       <ThemeControl />                               {/* this package — wired theme toggle, last item */}
//     </TopBar.Right>
//   </TopBar>
//
// Ported from the design source's TopBar component (JSX→TSX, typed props).

import type { ComponentChildren, JSX } from "preact";

export interface TopBarProps {
  children?: ComponentChildren;
}

export interface TopBarComponent {
  (props: TopBarProps): JSX.Element;
  Right: (props: TopBarProps) => JSX.Element;
}

function TopBarBase({ children }: TopBarProps) {
  return <header class="my-topbar">{children}</header>;
}

function TopBarRight({ children }: TopBarProps) {
  return <div class="my-topbar__right">{children}</div>;
}

export const TopBar = TopBarBase as TopBarComponent;
TopBar.Right = TopBarRight;
