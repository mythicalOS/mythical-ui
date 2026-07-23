// @mythicalos/shell — barrel. Mirrors design-export's mythical-ui/src/index.js export surface:
// the mythical FAMILY SHELL, the central modules that must be identical across every product
// (BROKKR / SKULD / SAGA / EDDA), built on top of:
//   • tokens CSS              → import '@mythicalos/tokens/tokens.css' once
//   • @mythicalos/preact-ui   → executable atoms (Button, Input, Toast, ConfirmDialog, Chip, …)
//   • @mythicalos/ui-core/styles.css → the atoms' stylesheet
//
// This package adds what those two don't: the product selector + registry, the top bar, nav, the
// list+detail workspace, the settings layout, and useTheme. Ship `@mythicalos/shell/styles.css`
// after ui-core's — see this package's README for the three-layer import order.

export { Logo, LogoMark, type LogoProps, type LogoMarkProps } from "./Logo.js";
export {
  ProductSwitcher,
  type ProductSwitcherProps,
  // internal-but-exported helpers (not part of the export surface named in the design-export
  // README's export table) kept importable for consumers who need the pure routing decision or
  // want to render the panel outside the trigger — and for this package's own tests, which need
  // both to exercise ProductSwitcher's behavior without a DOM (see product-switcher.test.tsx).
  resolveSwitcherPick,
  SwitcherPanel,
  type ResolveSwitcherPickHandlers,
  type SwitcherPickResult,
  type SwitcherPanelProps,
} from "./ProductSwitcher.js";
export { TopBar, type TopBarProps } from "./TopBar.js";
export { NavTabs, type NavTabsProps, type NavTabItem } from "./NavTabs.js";
export {
  WorkspaceSplit,
  RailHead,
  RailList,
  RailGroup,
  RailCard,
  type WorkspaceSplitProps,
  type RailHeadProps,
  type RailListProps,
  type RailGroupProps,
  type RailCardProps,
  type RailCardState,
} from "./Workspace.js";
export {
  SettingsLayout,
  SettingsNav,
  type SettingsLayoutProps,
  type SettingsNavProps,
  type SettingsNavItem,
} from "./Settings.js";
export { PRODUCTS, FAMILY_NOTE, type Product, type ProductState } from "./products.js";
export {
  useTheme,
  DEFAULT_THEME_STORAGE_KEY,
  type Theme,
  type UseThemeOptions,
  type UseThemeResult,
} from "./hooks/useTheme.js";
