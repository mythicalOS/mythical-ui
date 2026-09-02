/** @jsxImportSource preact */
// @mythicalos/preact-ui — callout (ds/components-callout): the titled tone box, bigger than a
// banner (which stays the one-line notice). Classes and the tone vocabulary come from
// `@mythicalos/ui-core`; glyphs ride the banner's own tone-glyph map (BANNER_ICON — every
// CalloutTone is a BannerTone), so no second glyph derivation exists. Two title dresses, ONE per
// callout, never both: `title` (the body-lg tone-ink row, carrying the glyph) or `kicker` (the
// micro-uppercase list-box header, no glyph). When a caller passes both, `title` — the fuller
// dress — wins and `kicker` is dropped, so the markup can never claim both at once.
//
// HelpButton is the family's opener: the tiny round "?" that toggles a help callout. Its
// accessible name defaults to the pages' own wording (HELP_LABEL) and its open state is
// announced (`aria-expanded`) with the same boolean that paints it — never one without the other.

import type { ComponentChildren } from "preact";
import {
  BANNER_ICON,
  CALLOUT_PARTS,
  CALLOUT_TONES,
  HELP_GLYPH,
  HELP_LABEL,
  calloutClass,
  helpClass,
  type CalloutTone,
} from "@mythicalos/ui-core/logic";

export { CALLOUT_PARTS, CALLOUT_TONES, HELP_GLYPH, HELP_LABEL, calloutClass, helpClass, type CalloutTone };

export interface CalloutProps {
  tone?: CalloutTone;
  /** The body-lg title row (success/guidance panels). One of title/kicker — never both. */
  title?: ComponentChildren;
  /** The micro-uppercase header (titled list boxes). One of title/kicker — never both. */
  kicker?: ComponentChildren;
  /** Overrides the tone's default title glyph (BANNER_ICON — rule-7 discipline). */
  glyph?: string;
  /** Action row (`.btn` children). */
  actions?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

export function Callout(props: CalloutProps) {
  const { tone = "accent", glyph, actions, children, class: cls = "" } = props;
  const hasTitle = Boolean(props.title);
  const hasKicker = !hasTitle && Boolean(props.kicker); // title wins — never both
  return (
    <div class={`${calloutClass(tone)} ${cls}`}>
      {hasTitle ? (
        <div class={CALLOUT_PARTS.title}>
          <span class={CALLOUT_PARTS.glyph} aria-hidden="true">
            {glyph ?? BANNER_ICON[tone]}
          </span>
          {props.title}
        </div>
      ) : hasKicker ? (
        <div class={CALLOUT_PARTS.kicker}>{props.kicker}</div>
      ) : null}
      <div class={CALLOUT_PARTS.body}>{children}</div>
      {actions ? <div class={CALLOUT_PARTS.acts}>{actions}</div> : null}
    </div>
  );
}

export interface HelpButtonProps {
  open?: boolean;
  onClick?: () => void;
  /** Accessible name; the pages' own "What is this?" when omitted. */
  label?: string;
  class?: string;
}

export function HelpButton(props: HelpButtonProps) {
  const { open = false, class: cls = "" } = props;
  const label = props.label || HELP_LABEL;
  return (
    <button
      type="button"
      class={`${helpClass({ open })} ${cls}`}
      aria-label={label}
      aria-expanded={open ? "true" : "false"}
      title={label}
      onClick={props.onClick}
    >
      {HELP_GLYPH}
    </button>
  );
}
