/** @jsxImportSource preact */
// @mythicalos/shell — the family list+detail workspace: a fixed-width left rail beside a
// scrolling detail pane. Compose:
//   <WorkspaceSplit>
//     <WorkspaceSplit.Rail> …head, toolbar, list… </WorkspaceSplit.Rail>
//     <WorkspaceSplit.Detail> …selected item… </WorkspaceSplit.Detail>
//   </WorkspaceSplit>
//
// Ported from design-export's mythical-ui/src/components/Workspace.jsx (JSX→TSX, typed props).

import type { ComponentChildren, JSX } from "preact";

export interface WorkspaceSplitProps {
  children?: ComponentChildren;
}

export interface WorkspaceSplitComponent {
  (props: WorkspaceSplitProps): JSX.Element;
  Rail: (props: WorkspaceSplitProps) => JSX.Element;
  Detail: (props: WorkspaceSplitProps) => JSX.Element;
}

function WorkspaceSplitBase({ children }: WorkspaceSplitProps) {
  return <div class="my-split">{children}</div>;
}

function Rail({ children }: WorkspaceSplitProps) {
  return <div class="my-split__rail">{children}</div>;
}

function Detail({ children }: WorkspaceSplitProps) {
  return <div class="my-split__detail">{children}</div>;
}

export const WorkspaceSplit = WorkspaceSplitBase as WorkspaceSplitComponent;
WorkspaceSplit.Rail = Rail;
WorkspaceSplit.Detail = Detail;

export interface RailHeadProps {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  action?: ComponentChildren;
}

/** Rail header (76px, matches the top bar's optical height). */
export function RailHead({ title, subtitle, action }: RailHeadProps) {
  return (
    <div class="my-rail__head">
      <div class="my-rail__head-body">
        <div class="my-rail__title">{title}</div>
        {/* deliberate deviation from design-export's && form to avoid Preact's falsy-render-of-0 artifact; behavior identical for string/undefined */}
        {subtitle ? <div class="my-rail__subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  );
}

export interface RailListProps {
  children?: ComponentChildren;
}

/** Scrolling list body. Children are typically <RailGroup>s or <RailCard>s. */
export function RailList({ children }: RailListProps) {
  return <div class="my-rail__list">{children}</div>;
}

export interface RailGroupProps {
  label?: ComponentChildren;
  children?: ComponentChildren;
}

export function RailGroup({ label, children }: RailGroupProps) {
  return (
    <div class="my-rail__group">
      {/* deliberate deviation from design-export's && form to avoid Preact's falsy-render-of-0 artifact; behavior identical for string/undefined */}
      {label ? <div class="my-rail__group-label">{label}</div> : null}
      {children}
    </div>
  );
}

export type RailCardState = "default" | "active" | "warn";

export interface RailCardProps {
  state?: RailCardState;
  onClick?: () => void;
  children?: ComponentChildren;
}

const RAIL_CARD_STATE_CLASS: Record<RailCardState, string> = {
  default: "",
  active: " is-active",
  warn: " is-warn",
};

/** Selectable rail card. */
export function RailCard({ state = "default", onClick, children }: RailCardProps) {
  return (
    <button class={`my-rail-card${RAIL_CARD_STATE_CLASS[state]}`} onClick={onClick}>
      {children}
    </button>
  );
}
