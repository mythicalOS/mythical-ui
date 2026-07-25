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
import { useId, useState } from "preact/hooks";

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
  onInput?: (value: string) => void;
  onKeyDown?: (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => void;
}

/** The reveal toggle's accessible name, per state. Exported for the tests + any consumer that
 *  needs to find the control by name. */
export const REVEAL_SHOW_LABEL = "Show token";
export const REVEAL_HIDE_LABEL = "Hide token";

export interface RevealToggleProps {
  /** True while the secret is shown in the clear. */
  revealed: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

/**
 * The show/hide button `Input` renders inside a `revealable` password field. A real
 * `<button type="button">` — focusable in source order, no tabindex games — carrying the
 * state on `aria-pressed` and the action in its `aria-label`. It never receives, holds or
 * renders the field's value.
 */
export function RevealToggle({ revealed, disabled, onToggle }: RevealToggleProps) {
  return (
    <button
      type="button"
      class="input-reveal__btn"
      aria-label={revealed ? REVEAL_HIDE_LABEL : REVEAL_SHOW_LABEL}
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
  const reveal = props.revealable === true && type === "password";
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
      autocomplete="off"
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

export function Input(props: InputProps) {
  // Held here, never lifted into the props: a revealed secret must not survive a parent re-render
  // decision, and no consumer can force the field open.
  const [revealed, setRevealed] = useState(false);
  const autoId = useId();
  return (
    <InputBody
      {...props}
      revealed={revealed}
      onToggleReveal={() => setRevealed((v) => !v)}
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
