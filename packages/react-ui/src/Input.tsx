// @mythicalos/react-ui — text input + toggle + checkbox (ds/components-inputs). Error is reserved
// for validation failures; empty/unset renders neutral ("unconfigured is a valid state"); the error
// message always pairs an icon + text under the field, never the border alone (book §6).
//
// React twin of packages/preact-ui/src/Input.tsx. `@mythicalos/ui-core` has no equivalent
// `inputClass`/`toggleClass`/`checkboxClass` logic module (Task 2 only extracted
// buttonClass/typedNameMatches/composeToastText/gaugeTone-gaugeGeom/chipClass/statusLineClass/
// bannerClass) — the small boolean-flag class lists below are literal, structural (the same
// category as the wrapper `<div>`s elsewhere in this package), so they stay here unchanged, exactly
// as they do in the Preact sibling.
//
// Preact→React notes: `onInput` stays the PUBLIC prop name (parity with preact-ui's contract) but
// is wired to React's `onChange` internally — React fires `onChange` on every keystroke for text
// inputs (unlike the native "change" event), so this is a faithful behavioral match, not just a
// naming shim. The handler is now attached UNCONDITIONALLY (not `props.onInput ? handler :
// undefined` as in the Preact source) so a `value`-bearing input is always "controlled" from
// React's point of view — Preact never warns about a value-without-onChange field, React does, and
// the task requires zero console warnings in tests.

import type { ReactNode, KeyboardEvent } from "react";

export interface InputProps {
  label?: ReactNode;
  value?: string;
  placeholder?: string;
  error?: string;
  help?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  mono?: boolean;
  dirty?: boolean;
  type?: string;
  id?: string;
  onInput?: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function Input(props: InputProps) {
  const cls = ["input"];
  if (props.error) cls.push("is-err");
  if (props.mono) cls.push("mono");
  if (props.dirty) cls.push("is-dirty");
  if (props.readOnly) cls.push("readonly-input");
  const field = (
    <>
      <input
        id={props.id}
        type={props.type ?? "text"}
        className={cls.join(" ")}
        value={props.value ?? ""}
        placeholder={props.placeholder}
        disabled={props.disabled}
        readOnly={props.readOnly}
        // Local single-user config UI: these are identifiers/paths/config values (slugs, names,
        // model ids, urls), never autofill targets — kill browser autocomplete, the annoying
        // first-letter auto-capitalize, autocorrect, and spellcheck squiggles on all of them.
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={props.error ? "true" : undefined}
        onChange={(e) => props.onInput?.(e.target.value)}
        onKeyDown={props.onKeyDown}
      />
      {props.help && !props.error ? <div className="help">{props.help}</div> : null}
      {props.error ? (
        <div className="emsg">
          <span aria-hidden="true">⚠</span>
          <span>{props.error}</span>
        </div>
      ) : null}
    </>
  );
  if (!props.label) return field;
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      {field}
    </label>
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
      className={cls.join(" ")}
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
  label?: ReactNode;
  onToggle?: (next: boolean) => void;
}

export function Checkbox(props: CheckboxProps) {
  const cls = ["cb"];
  if (props.checked) cls.push("is-on");
  if (props.disabled) cls.push("is-disabled");
  const box = (
    <button
      type="button"
      className={cls.join(" ")}
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
    <label className="check-row">
      {box}
      <span>{props.label}</span>
    </label>
  );
}
