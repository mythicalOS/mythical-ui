// @mythicalos/react-ui — search / filter input with a leading glyph and a clear button when
// non-empty.
//
// React twin of packages/preact-ui/src/SearchInput.tsx. No tone/state derivation — literal
// structural classes only. The clear `<button>` keeps its explicit `type="button"` (the source's
// fix over the original design-export component, carried into the Preact sibling too — prevents an
// unintended form-submit inside a native `<form>`).
//
// Preact→React notes: `onInput` stays the PUBLIC prop name (parity with preact-ui's contract) —
// wired internally to React's `onChange`, which fires on the same "every keystroke" cadence as the
// native "input" event Preact's `onInput` listens to. Unlike the Preact source's
// `onInput={onInput}` (which leaves the DOM handler `undefined` when the caller doesn't pass one),
// this binding always attaches a stable handler (falling back to a no-op) — a `value`-bearing
// `<input>` with no `onChange` at all trips React's controlled-component console warning, which
// Preact never checks for.

import type { ChangeEvent, MouseEvent } from "react";

export interface SearchInputProps {
  value?: string;
  placeholder?: string;
  onInput?: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear?: (e: MouseEvent<HTMLButtonElement>) => void;
}

const noop = () => {};

export function SearchInput(props: SearchInputProps) {
  const { value, onInput, onClear, placeholder = "Search…" } = props;
  return (
    <div className="my-search">
      <span className="my-search__icon">⌕</span>
      <input className="my-search__input" value={value} onChange={onInput ?? noop} placeholder={placeholder} />
      {value ? (
        <button type="button" className="my-search__clear" title="Clear" onClick={onClear}>
          ✕
        </button>
      ) : null}
    </div>
  );
}
