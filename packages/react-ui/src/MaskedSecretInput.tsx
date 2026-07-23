// @mythicalos/react-ui — masked secret input with slot chip (ds/components-inputs "secret slots").
// A filled slot shows the server's mask (readonly — the value never round-trips to the UI) + the
// slot chip + a "Replace" affordance that re-opens entry; an unset slot shows the dashed empty
// chip ("unconfigured is a valid state"). Submitting a new value is the PARENT's concern (it PUTs
// to the secrets route and never reads the value back); this component is presentation + entry only.
//
// React twin of packages/preact-ui/src/MaskedSecretInput.tsx. Both the filled-mask input (readOnly,
// no handler needed — React's controlled-without-onChange warning is suppressed by `readOnly`) and
// the entry input (local `useState`, always has a real `onChange`) are already React-safe with no
// extra wiring required.

import { useState } from "react";
import { Button } from "./Button.js";

export interface MaskedSecretInputProps {
  label: string;
  /** Full slot name, e.g. "model/claude" — shown as the chip. */
  slot: string;
  /** True when the server's secrets list contains `slot`. */
  filled: boolean;
  /** The server's masked echo, when known (e.g. "sk-…3kfa"). */
  masked?: string;
  /** Labels the entry lane so the operator knows what to paste. */
  entryHint?: string;
  disabled?: boolean;
  /** Called with the raw entered value on submit — the parent PUTs it and never reads it back. */
  onSubmit?: (value: string) => void;
}

export function MaskedSecretInput(props: MaskedSecretInputProps) {
  const [editing, setEditing] = useState(!props.filled);
  const [value, setValue] = useState("");

  const chip = props.filled ? (
    <span className="chip">{props.slot}</span>
  ) : (
    <span className="chip chip--empty">slot empty</span>
  );

  if (props.filled && !editing) {
    return (
      <label className="field">
        <span className="field-label">{props.label}</span>
        <div className="slot">
          <input className="input mono readonly-input" value={props.masked ?? "••••••••"} readOnly />
          {chip}
          <button type="button" className="rep" disabled={props.disabled} onClick={() => setEditing(true)}>
            Replace
          </button>
        </div>
        <div className="help">Readonly mask; Replace re-opens entry. The value never round-trips to the UI.</div>
      </label>
    );
  }

  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <div className="slot">
        <input
          className="input mono"
          // diff r1-F10 (S1a-11): a replacement credential is a SECRET while typed — masked entry
          // (type=password) + new-password so the browser neither displays nor offers to save it.
          type="password"
          value={value}
          placeholder={props.entryHint ?? "paste token…"}
          disabled={props.disabled}
          // A pasted credential: never autofill/autocapitalize/autocorrect/spellcheck it.
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setValue(e.target.value)}
        />
        {chip}
        <Button
          variant="sec"
          small
          disabled={props.disabled || value.trim().length === 0}
          onClick={() => {
            props.onSubmit?.(value);
            setValue("");
            if (props.filled) setEditing(false);
          }}
        >
          Save
        </Button>
      </div>
      <div className="help">Unconfigured is a valid state — no error until submit.</div>
    </label>
  );
}
