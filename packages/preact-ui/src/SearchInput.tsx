/** @jsxImportSource preact */
// @mythicalos/preact-ui — search / filter input with a leading glyph and a clear button when
// non-empty.
//
// Ported from design-export's packages/preact-ui/src/components/SearchInput.jsx (JSX→TSX, typed
// props). No tone/state derivation — literal structural classes only.
//
// Fix over the source: the clear `<button>` had no explicit `type` attribute, so inside a native
// `<form>` it would default to `type="submit"` (an unintended form-submit on click). Added
// `type="button"` — an internal-implementation fix with no prop/API change.

import type { JSX } from "preact";

export interface SearchInputProps {
  value?: string;
  placeholder?: string;
  onInput?: (e: JSX.TargetedEvent<HTMLInputElement>) => void;
  onClear?: (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => void;
}

export function SearchInput(props: SearchInputProps) {
  const { value, onInput, onClear, placeholder = "Search…" } = props;
  return (
    <div class="my-search">
      <span class="my-search__icon">⌕</span>
      <input class="my-search__input" value={value} onInput={onInput} placeholder={placeholder} />
      {value ? (
        <button type="button" class="my-search__clear" title="Clear" onClick={onClear}>
          ✕
        </button>
      ) : null}
    </div>
  );
}
