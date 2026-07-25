/** @jsxImportSource preact */
// @mythicalos/preact-ui — text input + toggle + checkbox (ds/components-inputs). Error is reserved
// for validation failures; empty/unset renders neutral ("unconfigured is a valid state"); the error
// message always pairs an icon + text under the field, never the border alone (book §6).
//
// Ported verbatim from the family's internal Preact atoms package (Input.tsx). `@mythicalos/ui-core`
// has no equivalent `inputClass`/`toggleClass`/`checkboxClass` logic module (Task 2 only extracted
// buttonClass/typedNameMatches/composeToastText/gaugeTone-gaugeGeom/chipClass/statusLineClass/
// bannerClass) — the small boolean-flag class lists below are literal, structural (the same
// category as the wrapper `<div>`s elsewhere in this package), so they stay here unchanged. See
// the task report's "concerns" section if a future core module should absorb these too.

import type { ComponentChildren, JSX } from "preact";
import { useRef, useState } from "preact/hooks";

export interface InputProps {
  label?: ComponentChildren;
  value?: string;
  placeholder?: string;
  error?: string;
  help?: ComponentChildren;
  disabled?: boolean;
  readOnly?: boolean;
  mono?: boolean;
  dirty?: boolean;
  type?: string;
  id?: string;
  /**
   * Opt-in show/hide affordance for a secret field. Honored only for `type="password"`; every
   * other type (and the default, `revealable` absent/false) renders exactly what it always did.
   * The field starts hidden — revealing is always an explicit act.
   */
  revealable?: boolean;
  /**
   * Overrides the reveal toggle's accessible name for a field that is not a token — e.g.
   * `{ show: "Show API key", hide: "Hide API key" }`. Defaults to the token wording.
   */
  revealLabels?: RevealLabels;
  onInput?: (value: string) => void;
  onKeyDown?: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void;
}

export interface RevealLabels {
  show: string;
  hide: string;
}

/** The reveal toggle's default accessible name, per state. Exported for the tests + any consumer
 *  that needs to find the control by name. */
export const REVEAL_SHOW_LABEL = "Show token";
export const REVEAL_HIDE_LABEL = "Hide token";
export const REVEAL_LABELS: RevealLabels = { show: REVEAL_SHOW_LABEL, hide: REVEAL_HIDE_LABEL };

export interface RevealToggleProps {
  /** True while the secret is shown in the clear. */
  revealed: boolean;
  disabled?: boolean;
  labels?: RevealLabels;
  onToggle: () => void;
}

/**
 * The show/hide button `Input` renders inside a `revealable` password field. A real
 * `<button type="button">` — focusable in source order, no tabindex games — carrying the
 * state on `aria-pressed` and the action in its `aria-label`. It never receives, holds or
 * renders the field's value.
 */
/** A caller-supplied name, or the default when it is not a usable one. Runtime-checked: this is a
 *  public prop of a published package, and a blank or missing override would leave the toggle
 *  named only by its two-letter visible text — or not at all. */
function revealName(supplied: unknown, fallback: string): string {
  return typeof supplied === "string" && supplied.trim().length > 0 ? supplied : fallback;
}

export function RevealToggle({ revealed, disabled, labels, onToggle }: RevealToggleProps) {
  const names = {
    show: revealName(labels?.show, REVEAL_SHOW_LABEL),
    hide: revealName(labels?.hide, REVEAL_HIDE_LABEL),
  };
  return (
    <button
      type="button"
      class="input-reveal__btn"
      // Both the name and aria-pressed move, deliberately. The name has to state the action for
      // the (larger) group of users who see only "show"/"hide", and aria-pressed has to state the
      // fact for anyone who queries it; a reader announcing "Hide token, toggle button, pressed"
      // is redundant, never wrong. The visible word is contained in the name (WCAG 2.5.3).
      aria-label={revealed ? names.hide : names.show}
      aria-pressed={revealed ? "true" : "false"}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
    >
      {revealed ? "hide" : "show"}
    </button>
  );
}

export interface InputBodyProps extends InputProps {
  /** Reveal state, lifted out of `Input` so a DOM-free test can render BOTH states. */
  revealed: boolean;
  onToggleReveal: () => void;
  /** Fallback id for the reveal path's explicit label/control pairing (see below). */
  autoId: string;
}

/**
 * `Input`'s hook-free body — exactly the markup `Input` renders, with the reveal state passed in
 * instead of held. Split out for the same reason `SwitcherPanel` is in the shell package: this
 * codebase's bun:test environment has no DOM, so a state-driven variant can only be reached by
 * rendering the hook-free piece directly, and the toggle's real `onClick` closure can only be
 * invoked by calling this as a plain function. Not part of the package's barrel.
 */
export function InputBody(props: InputBodyProps) {
  const cls = ["input"];
  if (props.error) cls.push("is-err");
  if (props.mono) cls.push("mono");
  if (props.dirty) cls.push("is-dirty");
  if (props.readOnly) cls.push("readonly-input");
  const type = props.type ?? "text";
  const reveal = isRevealMode(props);
  // The reveal path needs an id on the input: its toggle is a <button>, and a <button> is a
  // labelable element — HTML forbids one inside a <label> that isn't labelling it, and the
  // accessible-name computation would fold the button's own name ("Show token") into the
  // input's. So that path swaps the wrapping-<label> form for an explicit for/id pairing.
  // Every other path is untouched.
  const id = props.id ?? (reveal ? props.autoId : undefined);
  const control = (
    <input
      id={id}
      // The ONLY thing revealing changes: password ⇄ text on the field itself. The value is
      // never copied anywhere else in the tree.
      type={reveal && props.revealed ? "text" : type}
      class={cls.join(" ")}
      value={props.value ?? ""}
      placeholder={props.placeholder}
      disabled={props.disabled}
      readonly={props.readOnly}
      // Local single-user config UI: these are identifiers/paths/config values (slugs, names,
      // model ids, urls), never autofill targets — kill browser autocomplete, the annoying
      // first-letter auto-capitalize, autocorrect, and spellcheck squiggles on all of them.
      // On the reveal path the field is a declared secret, and browsers/password managers largely
      // IGNORE autocomplete="off" on type=password — they will autofill it and offer to save it
      // as a login credential. `new-password` is what actually suppresses both, and is already
      // this package's policy for credential entry (see MaskedSecretInput).
      autocomplete={reveal ? "new-password" : "off"}
      autocapitalize="off"
      autocorrect="off"
      spellcheck={false}
      aria-invalid={props.error ? "true" : undefined}
      onInput={props.onInput ? (e) => props.onInput!((e.target as HTMLInputElement).value) : undefined}
      onKeyDown={props.onKeyDown}
    />
  );
  const field = (
    <>
      {reveal ? (
        <div class="input-reveal">
          {control}
          <RevealToggle
            revealed={props.revealed}
            disabled={props.disabled}
            labels={props.revealLabels}
            onToggle={props.onToggleReveal}
          />
        </div>
      ) : (
        control
      )}
      {props.help && !props.error ? <div class="help">{props.help}</div> : null}
      {props.error ? (
        <div class="emsg">
          <span aria-hidden="true">⚠</span>
          <span>{props.error}</span>
        </div>
      ) : null}
    </>
  );
  if (!props.label) return field;
  if (reveal) {
    return (
      <div class="field">
        <label class="field-label" for={id}>
          {props.label}
        </label>
        {field}
      </div>
    );
  }
  return (
    <label class="field">
      <span class="field-label">{props.label}</span>
      {field}
    </label>
  );
}

/**
 * Source of the reveal path's fallback field id.
 *
 * Deliberately NOT `useId`: that draws from preact's shared per-render id sequence, so taking one
 * here would renumber the ids of every OTHER component in a consumer's tree — an invisible
 * regression for an input that asked for none of this.
 *
 * A module counter is enough because this id never leaves the component. Its only job is to pair
 * THIS instance's `<label for>` with THIS instance's `<input id>`, and both sides are the same
 * value from the same render, so they cannot disagree with each other — which is the only
 * property that has to hold.
 *
 * It follows that the counter's one give — a server render and its hydration draw from different
 * counters, so the vdom's id and the hydrated DOM's id differ — is inert: preact does not rewrite
 * attributes while hydrating, and any later patch moves both halves together. Reaching for
 * `useId` to "fix" that would reintroduce a real, demonstrated regression (it renumbers every
 * OTHER component's ids in the consumer's tree) in exchange for a mismatch nothing reads. Pass
 * `id` yourself if you server-render and want a specific one.
 */
let revealIdSeq = 0;

/** True when the field is a secret that opted into the reveal affordance. */
export function isRevealMode(props: Pick<InputProps, "revealable" | "type">): boolean {
  return props.revealable === true && (props.type ?? "text") === "password";
}

/**
 * The reveal state to render this pass.
 *
 * ANY change of the field's mode clears it. A field that stops being a revealable secret and
 * later becomes one again must come back hidden: the alternative is a password rendered in the
 * clear that no one asked to see, on a render the user never touched.
 */
export function resolveRevealed(stored: boolean, storedMode: boolean, mode: boolean): boolean {
  return storedMode === mode ? stored : false;
}

export function Input(props: InputProps) {
  const mode = isRevealMode(props);
  // `Input` always renders the same child component and always runs the same hooks, so flipping
  // `revealable` or `type` re-renders the field instead of remounting it — a focused input keeps
  // its focus, caret and selection. That makes clearing the reveal on a mode change this
  // component's own job (see resolveRevealed), which is why the flag is a ref read during render
  // rather than plain state: it has to be cleared on the very render that changes the mode.
  //
  // It is held here and never lifted into the props either way: a revealed secret must not
  // survive a parent's re-render decision, and no consumer can force the field open.
  const revealed = useRef(false);
  const lastMode = useRef(mode);
  const [, bumpRender] = useState(0);
  revealed.current = resolveRevealed(revealed.current, lastMode.current, mode);
  lastMode.current = mode;

  const [autoId] = useState(() => `mythicalos-input-${++revealIdSeq}`);
  return (
    <InputBody
      {...props}
      revealed={revealed.current}
      onToggleReveal={() => {
        revealed.current = !revealed.current;
        bumpRender((n) => n + 1);
      }}
      autoId={autoId}
    />
  );
}

export interface ToggleProps {
  on: boolean;
  disabled?: boolean;
  label?: string;
  onToggle?: (next: boolean) => void;
}

export function Toggle(props: ToggleProps) {
  const cls = ["tog"];
  if (!props.on) cls.push("is-off");
  if (props.disabled) cls.push("is-disabled");
  return (
    <button
      type="button"
      class={cls.join(" ")}
      role="switch"
      aria-checked={props.on ? "true" : "false"}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.disabled ? undefined : () => props.onToggle?.(!props.on)}
    >
      <i aria-hidden="true" />
    </button>
  );
}

export interface CheckboxProps {
  checked: boolean;
  disabled?: boolean;
  label?: ComponentChildren;
  onToggle?: (next: boolean) => void;
}

export function Checkbox(props: CheckboxProps) {
  const cls = ["cb"];
  if (props.checked) cls.push("is-on");
  if (props.disabled) cls.push("is-disabled");
  const box = (
    <button
      type="button"
      class={cls.join(" ")}
      role="checkbox"
      aria-checked={props.checked ? "true" : "false"}
      disabled={props.disabled}
      onClick={props.disabled ? undefined : () => props.onToggle?.(!props.checked)}
    >
      {props.checked ? <span aria-hidden="true">✓</span> : null}
    </button>
  );
  if (!props.label) return box;
  return (
    <label class="check-row">
      {box}
      <span>{props.label}</span>
    </label>
  );
}
