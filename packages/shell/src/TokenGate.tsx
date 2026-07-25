/** @jsxImportSource preact */
// @mythicalos/shell — the family's shared bearer-token unlock card.
//
// Every product in the family protects its UI with a bearer token minted on first boot, and every
// one of them used to draw its own unlock screen. This is the one card they all render instead, so
// the first thing an operator ever sees is identical across the family: same mark, same copy, same
// affordances, same failure line.
//
// Two honesty rules are baked in and are not negotiable:
//   • The failure line is printed from the REAL status + reason of the rejected response. If the
//     product doesn't have both, no line is shown at all — this card never invents an HTTP status
//     or a reason to fill the space (`authErrorLine` is the whole decision, exported so a consumer
//     can test its own wiring against it).
//   • The placeholder never states a length or an alphabet. The products mint different token
//     formats and one of them is mid-migration, so any concrete hint would be wrong somewhere.

import { useState } from "preact/hooks";
import { Button, Input } from "@mythicalos/preact-ui";
import { Logo } from "./Logo.js";
import { PRODUCTS, type Product } from "./products.js";

export interface TokenGateProps {
  /** Product key — drives the Logo mark + heading. Same keys the PRODUCTS registry uses. */
  product: Product["key"];
  /** Container name used verbatim in the retrieval hint commands, e.g. "mythical". */
  container: string;
  /** Receives the TRIMMED token on submit. */
  onSubmit: (token: string) => void;
  /** The previous attempt was rejected. */
  invalid?: boolean;
  /** REAL http status from the failed response. Never fabricate one. */
  status?: number;
  /** REAL error reason string from the failed response. Never fabricate one. */
  reason?: string;
}

/** Body copy, first visit. */
export const TOKEN_GATE_BODY =
  "This UI is protected by a bearer token minted on first boot. Paste it once — it is stored in this browser.";

/** Body copy after a rejected token. */
export const TOKEN_GATE_INVALID_BODY =
  "That token was not accepted. Paste your ui/token — you can retrieve it from a terminal on the host.";

/**
 * The failure line, or `undefined` when there is nothing true to say.
 *
 * Both halves must be present: a status without a reason (or the reverse) would have to be padded
 * with something the product did not actually receive, and this card does not do that. `status` is
 * compared against `undefined`, never truthiness — `0` is a real status (a fetch that never
 * reached the server reports it) and must print.
 */
export function authErrorLine(status?: number, reason?: string): string | undefined {
  if (status === undefined || reason === undefined) return undefined;
  return `${status} · ${reason} — enter the token to continue`;
}

/** The product's display name, from the shared registry. Falls back to the key as given: naming
 *  the product by a key the registry doesn't carry is honest, inventing a display name is not. */
function displayName(key: string): string {
  const k = key.toLowerCase();
  return PRODUCTS.find((p) => p.key === k)?.name ?? key;
}

export interface TokenGateCardProps extends TokenGateProps {
  /** The field's current value, lifted out of `TokenGate`. */
  value: string;
  onValue: (next: string) => void;
}

/**
 * `TokenGate`'s hook-free body — the exact tree `TokenGate` renders, with the field's value passed
 * in instead of held. Split out for the reason `SwitcherPanel` is: this package's bun:test
 * environment has no DOM, so a non-empty field (and the submit closures that depend on it) can
 * only be reached by rendering/calling this directly. Not part of the package's barrel.
 */
export function TokenGateCard(props: TokenGateCardProps) {
  const trimmed = props.value.trim();
  const empty = trimmed.length === 0;
  // The line is only ever shown for a failed attempt, and only when the product handed over both
  // halves of what actually came back.
  const failure = props.invalid ? authErrorLine(props.status, props.reason) : undefined;
  const submit = () => {
    if (!empty) props.onSubmit(trimmed);
  };
  return (
    <div class="token-entry">
      <Logo product={props.product} />
      <h2 class="token-entry__title">Unlock {displayName(props.product)}</h2>
      <p class="token-entry__body">{props.invalid ? TOKEN_GATE_INVALID_BODY : TOKEN_GATE_BODY}</p>
      {failure ? (
        <div class="token-entry__err" role="alert">
          <span class="token-entry__err-glyph" aria-hidden="true">
            ▲
          </span>
          <span>{failure}</span>
        </div>
      ) : null}
      <Input
        label="UI token"
        mono
        type="password"
        revealable
        placeholder="paste your ui/token…"
        value={props.value}
        onInput={props.onValue}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          // Swallowed even when the field is empty: a product may render this card inside a form
          // of its own, and an empty Enter must not navigate the page away from the gate.
          e.preventDefault();
          submit();
        }}
      />
      <div class="token-entry__cta">
        <Button variant="pri" disabled={empty} onClick={submit}>
          Unlock
        </Button>
      </div>
      <div class="token-entry__hint">
        <span>Lost it? From a terminal on the host:</span>
        <code class="token-entry__cmd">$ docker exec {props.container} bun run token</code>
        <code class="token-entry__cmd">$ docker exec {props.container} bun run token -- --rotate</code>
        <span>Rotating prints a new token and signs out every browser holding the old one.</span>
      </div>
    </div>
  );
}

/** The unlock card. `onSubmit` receives the trimmed token; the field itself is never lifted out. */
export function TokenGate(props: TokenGateProps) {
  const [value, setValue] = useState("");
  return <TokenGateCard {...props} value={value} onValue={setValue} />;
}
