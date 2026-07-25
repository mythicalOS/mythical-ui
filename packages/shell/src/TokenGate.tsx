/** @jsxImportSource preact */
// @mythicalos/shell — the family's shared bearer-token unlock card.
//
// Every product in the family protects its UI with a bearer token minted on first boot, and every
// one of them used to draw its own unlock screen. This is the one card they all render instead, so
// the first thing an operator ever sees is identical across the family: same mark, same copy, same
// affordances, same failure line.
//
// Three honesty rules are baked in and are not negotiable:
//   • The failure line is printed from the REAL status + reason of the rejected response. If the
//     product doesn't have both, no line is shown at all — this card never invents an HTTP status
//     or a reason to fill the space (`authErrorLine` is the whole decision, exported so a consumer
//     can test its own wiring against it).
//   • The placeholder never states a length or an alphabet. The products mint different token
//     formats and one of them is mid-migration, so any concrete hint would be wrong somewhere.
//   • "Copied" is only ever shown for a clipboard write that actually resolved. The write is not
//     reliably available here (see `copyToClipboard`), so the outcome is always the real one — a
//     control that claims success for a clipboard that stayed empty is worse than no control.

import { useEffect, useRef, useState } from "preact/hooks";
import { Button, Input } from "@mythicalos/preact-ui";
import { Logo } from "./Logo.js";
import { PRODUCTS, type Product } from "./products.js";

/** The simple retrieval form: correct when the product's CLI sits at the image's default WORKDIR
 * and the image's default user may read the secret slot. Exported so a product can compose or
 * assert against it rather than restating the string. */
export function defaultRetrieveCommand(container: string): string {
  return `docker exec ${container} bun run token`;
}

/** The rotate variant of {@link defaultRetrieveCommand}. */
export function defaultRotateCommand(container: string): string {
  return `docker exec ${container} bun run token -- --rotate`;
}

export interface TokenGateProps {
  /** Product key — drives the Logo mark + heading. Same keys the PRODUCTS registry uses. */
  product: Product["key"];
  /** Container name, used verbatim to BUILD the default retrieval hint, e.g. "mythical". */
  container: string;
  /**
   * The command that prints the current token, when `docker exec <container> bun run token` is not
   * actually runnable in this product's image. A product whose CLI is not at the image's default
   * WORKDIR, or which must drop from root to a service user, MUST pass its real command here — a
   * hint the operator cannot paste is worse than no hint, because it is trusted and then fails.
   * Defaults to the simple form.
   */
  retrieveCommand?: string;
  /** As {@link retrieveCommand}, for the rotate variant. Defaults to the simple form. */
  rotateCommand?: string;
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
 * Both halves must be present AND be the real thing: a status without a reason (or the reverse)
 * would have to be padded with something the product did not actually receive, and this card does
 * not do that. The guards are runtime, not just typed — this ships to JavaScript consumers, and
 * `null` (a `res.status ?? null`), `NaN` (a parsed header that wasn't a number) or an empty
 * reason body are exactly how a fabricated "null · Unauthorized" line would get printed.
 *
 * Note it tests the number, never its truthiness: `0` is a real status — a request that never
 * reached the server reports it — and must print.
 */
export function authErrorLine(status?: number, reason?: string): string | undefined {
  if (!isRealStatus(status)) return undefined;
  if (typeof reason !== "string" || reason.trim().length === 0) return undefined;
  return `${status} · ${reason} — enter the token to continue`;
}

/**
 * Whether `status` can be something a response actually reported: an HTTP status code, or `0` —
 * what a request that never reached the server comes back as. A sentinel like `-1`, a fraction, a
 * NaN or a `null` is not a status, and printing one would be inventing the very thing this card
 * refuses to invent.
 */
function isRealStatus(status: unknown): status is number {
  if (typeof status !== "number" || !Number.isInteger(status)) return false;
  return status === 0 || (status >= 100 && status <= 599);
}

/** The product's display name, from the shared registry. Falls back to the key as given: naming
 *  the product by a key the registry doesn't carry is honest, inventing a display name is not. */
function displayName(key: string): string {
  const k = key.toLowerCase();
  return PRODUCTS.find((p) => p.key === k)?.name ?? key;
}

// ─── Copy-to-clipboard for the two hint commands ────────────────────────────────────────────────
//
// The `$ ` the hint draws in front of each command is a SHELL PROMPT — a display convention, not
// part of what the operator has to run. Everything below therefore carries the bare, runnable
// command; only the JSX adds the prompt. Copying `$ docker exec …` hands the operator something
// that fails the moment they paste it.

/** Which of the two hint commands a copy control acts on. */
export type CopyTarget = "retrieve" | "rotate";

/** The outcome of the most recent copy attempt, or `null` when there has not been one (or it has
 *  aged out). `ok` is the REAL result of the clipboard write — never an assumption. */
export interface CopyFeedback {
  target: CopyTarget;
  ok: boolean;
}

/** How long a copy outcome stays on the control before it returns to rest. */
export const COPY_FEEDBACK_MS = 2000;

/** The resting/settled state of one copy control. */
export type CopyControlState = "idle" | "copied" | "failed";

/** What each control acts on, in words — the tail of its accessible name. Two controls both named
 *  "Copy" are useless to anyone who is not looking at the screen, so the name states WHICH one. */
const COPY_WHAT: Record<CopyTarget, string> = {
  retrieve: "the token-retrieval command",
  rotate: "the token-rotation command",
};

/** The control's visible word, per state. The name below always CONTAINS it (WCAG 2.5.3
 *  label-in-name: a voice-control user says what they can see). */
export const COPY_WORD: Record<CopyControlState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Copy failed",
};

/** One control's state: only the control that was actually clicked shows an outcome. */
export function copyControlState(target: CopyTarget, feedback?: CopyFeedback | null): CopyControlState {
  if (!feedback || feedback.target !== target) return "idle";
  return feedback.ok ? "copied" : "failed";
}

/** The control's accessible name — always names which command, always contains its visible word. */
export function copyButtonLabel(target: CopyTarget, feedback?: CopyFeedback | null): string {
  const what = COPY_WHAT[target];
  switch (copyControlState(target, feedback)) {
    case "copied":
      return `Copied ${what}`;
    case "failed":
      return `Copy failed for ${what} — select the command and copy it manually`;
    default:
      return `Copy ${what}`;
  }
}

/**
 * The announcement for a copy outcome, or `""` at rest. Lives in a `role="status"` region that is
 * ALWAYS in the DOM: a live region inserted at the same moment it gains content is announced
 * unreliably. It is never on screen — the visible outcome is the control's own word and color.
 */
export function copyStatusLine(feedback?: CopyFeedback | null): string {
  if (!feedback) return "";
  const what = COPY_WHAT[feedback.target];
  return feedback.ok
    ? `Copied ${what} to the clipboard.`
    : `Could not copy ${what}. Select the command and copy it manually.`;
}

/** The shape of the clipboard this card is willing to use — anything less is treated as absent. */
interface ClipboardHost {
  navigator?: { clipboard?: { writeText?: (text: string) => unknown } };
}

/**
 * Writes `text` to the system clipboard, resolving to whether the write ACTUALLY happened.
 *
 * `navigator.clipboard` is not a given here. It exists only in a secure context, and every product
 * in this family is reachable over plain http on a LAN address as well as on `localhost` — so on
 * the LAN URL the API is simply absent, and the whole `navigator.clipboard` object is `undefined`.
 * It also rejects when the document is not focused, and a permissions policy can deny it outright.
 * Every one of those paths resolves `false` here, so the caller renders a real failure instead of
 * a "Copied" the operator would then paste nothing from.
 *
 * `text` is the runnable command; the hint's `$ ` prompt is never part of it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = (globalThis as ClipboardHost).navigator?.clipboard;
    if (typeof clipboard?.writeText !== "function") return false;
    // Invoked ON the clipboard object on purpose: `writeText` is a native method and throws if it
    // is torn off its receiver.
    await clipboard.writeText(text);
    return true;
  } catch {
    // A rejected write, a synchronous throw, a hostile `navigator` shim — all the same outcome:
    // nothing reached the clipboard, and this must not be reported as success.
    return false;
  }
}

/** The side effects one copy run needs. Injected — like `@mythicalos/ui-core`'s `PollTickIO` —
 *  so the sequencing below is exercised for real in a test environment that has no DOM. */
export interface CopyRunnerIO {
  /** The write itself. Defaults to {@link copyToClipboard} in `TokenGate`. */
  copy: (text: string) => Promise<boolean>;
  /** Publishes the outcome, or `null` for "no outcome to show". */
  setFeedback: (feedback: CopyFeedback | null) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export interface CopyRunner {
  /** Runs one copy attempt and publishes its REAL outcome. */
  run(target: CopyTarget, command: string): Promise<void>;
  /** Drops any pending revert timer — the unmount path. */
  dispose(): void;
}

/**
 * The copy sequencing, as a unit with no view and no hooks.
 *
 * Two orderings have to be right, and neither is reachable through the rendered card in a DOM-free
 * test, which is why they live here:
 *
 *   • A stale attempt never reports. Two clicks in flight — the first rejecting slowly, the second
 *     resolving fast — must not let the older outcome land on top of the newer one, which is how a
 *     control ends up showing "Copy failed" for a write that succeeded.
 *   • A new attempt retires the previous outcome AT ONCE, rather than leaning on that outcome's
 *     own revert timer. That timer belongs to a run that is no longer current; if the new write
 *     then takes longer than the revert window (or never settles at all — a permission prompt left
 *     open does exactly that), a "Copied" from the previous run would sit there indefinitely,
 *     pointing at a clipboard whose contents have since become a guess.
 */
export function createCopyRunner(io: CopyRunnerIO): CopyRunner {
  let seq = 0;
  let handle: unknown;
  const clear = () => {
    if (handle === undefined) return;
    io.clearTimer(handle);
    handle = undefined;
  };
  return {
    async run(target: CopyTarget, command: string): Promise<void> {
      const mine = ++seq;
      clear();
      io.setFeedback(null);
      const ok = await io.copy(command);
      if (mine !== seq) return; // superseded — the newer run owns the outcome
      io.setFeedback({ target, ok });
      // Only ever one timer alive: a later run clears this one before it can arm its own.
      handle = io.setTimer(() => {
        handle = undefined;
        io.setFeedback(null);
      }, COPY_FEEDBACK_MS);
    },
    dispose: clear,
  };
}

export interface CopyCommandButtonProps {
  target: CopyTarget;
  /** The RUNNABLE command — never the rendered line. The hint's `$ ` is a prompt this card draws. */
  command: string;
  /** The card's current copy outcome; only the matching `target` renders it. */
  feedback?: CopyFeedback | null;
  onCopy?: (target: CopyTarget, command: string) => void;
}

/**
 * The copy control for one command line. A real `<button type="button">` — focusable in source
 * order, no tabindex games — named for the command it copies. Purely additive: the command stays
 * rendered next to it as ordinary selectable text, which is the fallback when the clipboard write
 * cannot happen at all.
 */
export function CopyCommandButton(props: CopyCommandButtonProps) {
  const state = copyControlState(props.target, props.feedback);
  return (
    <button
      type="button"
      class={state === "idle" ? "token-entry__copy" : `token-entry__copy is-${state}`}
      aria-label={copyButtonLabel(props.target, props.feedback)}
      onClick={() => props.onCopy?.(props.target, props.command)}
    >
      {COPY_WORD[state]}
    </button>
  );
}

export interface TokenGateCardProps extends TokenGateProps {
  /** The field's current value, lifted out of `TokenGate`. */
  value: string;
  onValue: (next: string) => void;
  /** The last copy outcome, lifted out of `TokenGate` for the same reason `value` is. */
  copy?: CopyFeedback | null;
  onCopy?: (target: CopyTarget, command: string) => void;
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
  const retrieveCmd = props.retrieveCommand ?? defaultRetrieveCommand(props.container);
  const rotateCmd = props.rotateCommand ?? defaultRotateCommand(props.container);
  const submit = () => {
    if (!empty) props.onSubmit(trimmed);
  };
  return (
    // The card owns its own screen framing. Without this wrapper each consumer invents its own
    // vertical offset (one product padded the gate, another rendered it flush), so the "one card,
    // identical everywhere" guarantee held for the card but not for where it sat on the page.
    <div class="token-entry-screen">
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
          {/* The `$ ` is drawn here and ONLY here. What the button hands the clipboard is the bare
              command — a copied "$ docker exec …" is a line that fails when it is pasted. */}
          <div class="token-entry__cmd-row">
            <code class="token-entry__cmd">$ {retrieveCmd}</code>
            <CopyCommandButton
              target="retrieve"
              command={retrieveCmd}
              feedback={props.copy}
              onCopy={props.onCopy}
            />
          </div>
          <div class="token-entry__cmd-row">
            <code class="token-entry__cmd">$ {rotateCmd}</code>
            <CopyCommandButton
              target="rotate"
              command={rotateCmd}
              feedback={props.copy}
              onCopy={props.onCopy}
            />
          </div>
          <span>Rotating prints a new token and signs out every browser holding the old one.</span>
          {/* Always present, never visible — see `copyStatusLine`. */}
          <span class="token-entry__copy-status" role="status">
            {copyStatusLine(props.copy)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The unlock card. `onSubmit` receives the trimmed token; the field itself is never lifted out. */
export function TokenGate(props: TokenGateProps) {
  const [value, setValue] = useState("");
  const [copy, setCopy] = useState<CopyFeedback | null>(null);
  // All the sequencing lives in `createCopyRunner`; this only binds it to the real timers and to
  // this component's state setter (whose identity is stable, so one runner outlives every render).
  const runner = useRef<CopyRunner | undefined>(undefined);
  if (!runner.current) {
    runner.current = createCopyRunner({
      copy: copyToClipboard,
      setFeedback: setCopy,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
  }
  useEffect(() => () => runner.current?.dispose(), []);
  const onCopy = (target: CopyTarget, command: string) => {
    void runner.current?.run(target, command);
  };
  return (
    <TokenGateCard {...props} value={value} onValue={setValue} copy={copy} onCopy={onCopy} />
  );
}
