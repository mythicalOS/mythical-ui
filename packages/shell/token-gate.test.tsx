/** @jsxImportSource preact */
// packages/shell/token-gate.test.tsx — TokenGate, the card every product in the family renders
// instead of its own hand-rolled unlock screen. Three products build against this contract in
// parallel, so the shape (props, copy, order, submit semantics) is pinned here.
//
// Depth note (the technique nav-tabs.test.tsx / product-switcher.test.tsx already document):
// preact-render-to-string never dispatches DOM events and this package's bun:test environment has
// no `document`, so the field cannot be typed into. `TokenGateCard` — the hook-free body
// `TokenGate` renders — takes the value as a prop, so calling it as a plain function hands back
// the real vnode tree with the REAL onClick/onKeyDown/onInput closures still attached. Those are
// the shipped closures, invoked directly; only the browser's event dispatch is missing.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import { Button, Input } from "@mythicalos/preact-ui";
import { PRODUCTS } from "./src/index.ts";
import {
  authErrorLine,
  copyButtonLabel,
  copyControlState,
  copyStatusLine,
  copyToClipboard,
  CopyCommandButton,
  CopyIcon,
  createCopyRunner,
  COPY_ICON_PATHS,
  COPY_WORD,
  TokenGate,
  TokenGateCard,
  TOKEN_GATE_BODY,
  TOKEN_GATE_INVALID_BODY,
  type CopyFeedback,
  type CopyTarget,
  type TokenGateCardProps,
} from "./src/TokenGate.tsx";

const noop = () => {};

const base: TokenGateCardProps = {
  product: "brokkr",
  container: "mythical",
  onSubmit: noop,
  value: "",
  onValue: noop,
};

/** TokenGateCard uses no hooks, so calling it directly returns the real vnode tree. */
function callCard(props: Partial<TokenGateCardProps>): VNode<Record<string, unknown>> {
  return (TokenGateCard as unknown as (p: TokenGateCardProps) => VNode<Record<string, unknown>>)({
    ...base,
    ...props,
  });
}

/** Every vnode in the tree, in document order, with its real props/closures. */
function collect(node: unknown, out: VNode<Record<string, unknown>>[] = []): VNode<Record<string, unknown>>[] {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out);
    return out;
  }
  if (!node || typeof node !== "object") return out;
  const v = node as VNode<Record<string, unknown>>;
  if (v.type === undefined) return out;
  out.push(v);
  collect((v.props as { children?: unknown } | undefined)?.children, out);
  return out;
}

function findAll(props: Partial<TokenGateCardProps>, type: unknown): VNode<Record<string, unknown>>[] {
  return collect(callCard(props)).filter((v) => v.type === type);
}

function findOne(props: Partial<TokenGateCardProps>, type: unknown): VNode<Record<string, unknown>> {
  const hits = findAll(props, type);
  expect(hits.length).toBe(1);
  return hits[0]!;
}

function html(props: Partial<TokenGateCardProps> = {}): string {
  return renderToString(<TokenGateCard {...base} {...props} />);
}

describe("authErrorLine — the never-fabricate rule, as a pure function", () => {
  test("both halves present ⇒ the exact line", () => {
    expect(authErrorLine(401, "invalid token")).toBe(
      "401 · invalid token — enter the token to continue",
    );
  });

  test("status 0 is a REAL status (a request that never reached the server) and must print", () => {
    expect(authErrorLine(0, "network error")).toBe(
      "0 · network error — enter the token to continue",
    );
  });

  test.each([100, 401, 403, 500, 599])("%p is inside the HTTP range and prints", (status) => {
    expect(authErrorLine(status, "nope")).toBe(`${status} · nope — enter the token to continue`);
  });

  test("either half missing ⇒ undefined, never a padded line", () => {
    expect(authErrorLine(undefined, "invalid token")).toBeUndefined();
    expect(authErrorLine(401, undefined)).toBeUndefined();
    expect(authErrorLine()).toBeUndefined();
  });

  test.each([
    ["null status", null, "invalid token"],
    ["NaN status", NaN, "invalid token"],
    ["Infinity status", Infinity, "invalid token"],
    ["string status", "401", "invalid token"],
    ["null reason", 401, null],
    ["empty reason", 401, ""],
    ["whitespace reason", 401, "   \n"],
    ["non-string reason", 401, 42],
    ["a -1 sentinel, which is not a status", -1, "no response"],
    ["a fractional status", 401.5, "invalid token"],
    ["a status below the HTTP range", 99, "invalid token"],
    ["a status above the HTTP range", 600, "invalid token"],
  ])("%s ⇒ undefined — the guards are runtime, not just typed", (_name, status, reason) => {
    // this ships to JavaScript consumers; a `res.status ?? null` or an empty error body must not
    // become "null · Unauthorized — …"
    expect(authErrorLine(status as number, reason as string)).toBeUndefined();
  });
});

describe("TokenGate — the card's structure, top to bottom", () => {
  test("renders inside a .token-entry card", () => {
    expect(html()).toContain('<div class="token-entry">');
  });

  // The package owns the gate's screen framing. When it did not, each consumer invented its own
  // vertical offset and the card sat at a different height per product — the card was identical,
  // its placement was not. Pinned so a refactor cannot quietly hand framing back to consumers.
  test("the card is wrapped in the package's own .token-entry-screen framing", () => {
    expect(html()).toContain('<div class="token-entry-screen"><div class="token-entry">');
  });


  test("logo, heading, body, field, CTA and hint appear in that order", () => {
    const out = html();
    const order = [
      "my-logo",
      "token-entry__title",
      "token-entry__body",
      "field-label",
      "token-entry__cta",
      "token-entry__hint",
    ];
    let last = -1;
    for (const marker of order) {
      const at = out.indexOf(marker);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  test("the mark is the product you are unlocking", () => {
    expect(html({ product: "saga" })).toContain("my-logo__mark");
  });

  test("the heading names the product from the shared registry", () => {
    for (const p of PRODUCTS) {
      expect(html({ product: p.key })).toContain(`<h2 class="token-entry__title">Unlock ${p.name}</h2>`);
    }
  });

  test("an unregistered key falls back to the key itself — never an invented name", () => {
    expect(html({ product: "nornir" })).toContain(">Unlock nornir</h2>");
  });

  test("the heading never claims the product is containerized", () => {
    // these products also run uncontainerized in dev; the heading must not say "this container"
    expect(html()).not.toContain("this container");
  });

  test("no export ever emits an inline style attribute (CSP style-src 'self')", () => {
    expect(html()).not.toContain("style=");
    expect(html({ invalid: true, status: 401, reason: "bad token" })).not.toContain("style=");
  });
});

describe("TokenGate — body copy", () => {
  test("first visit", () => {
    const out = html();
    expect(out).toContain(TOKEN_GATE_BODY);
    expect(out).not.toContain(TOKEN_GATE_INVALID_BODY);
  });

  test("after a rejected token", () => {
    const out = html({ invalid: true });
    expect(out).toContain(TOKEN_GATE_INVALID_BODY);
    expect(out).not.toContain(TOKEN_GATE_BODY);
  });
});

describe("TokenGate — the failure line is printed, never invented", () => {
  const LINE = "401 · bad token — enter the token to continue";

  test("invalid + real status + real reason ⇒ the line, in a warn note", () => {
    const out = html({ invalid: true, status: 401, reason: "bad token" });
    expect(out).toContain('<div class="token-entry__err" role="alert">');
    expect(out).toContain(LINE);
  });

  test("the ▲ is decoration — the sentence carries the meaning", () => {
    const out = html({ invalid: true, status: 401, reason: "bad token" });
    expect(out).toContain('<span class="token-entry__err-glyph" aria-hidden="true">▲</span>');
  });

  test.each([
    ["no status", { invalid: true, reason: "bad token" }],
    ["no reason", { invalid: true, status: 401 }],
    ["neither", { invalid: true }],
    ["not invalid, but both present", { status: 401, reason: "bad token" }],
    ["nothing at all", {}],
    ["an empty reason body", { invalid: true, status: 401, reason: "" }],
    ["a null status from JS", { invalid: true, status: null, reason: "bad token" }],
  ])("%s ⇒ no error line at all", (_name, props) => {
    const out = html(props as Partial<TokenGateCardProps>);
    expect(out).not.toContain("token-entry__err");
    expect(out).not.toContain("enter the token to continue");
  });

  test("status 0 with a reason still prints", () => {
    expect(html({ invalid: true, status: 0, reason: "network error" })).toContain(
      "0 · network error — enter the token to continue",
    );
  });
});

describe("TokenGate — the field", () => {
  const out = html();

  test("labelled, monospace, masked, and revealable", () => {
    expect(out).toContain(">UI token</label>");
    expect(out).toContain('class="input mono"');
    expect(out).toContain('type="password"');
    expect(out).toContain('class="input-reveal__btn"');
    expect(out).toContain('aria-label="Show token"');
  });

  test("the placeholder stays format-agnostic — no length, no alphabet", () => {
    const placeholder = out.match(/placeholder="([^"]*)"/)?.[1];
    expect(placeholder).toBe("paste your ui/token…");
    expect(placeholder).not.toMatch(/[0-9]/);
    expect(placeholder?.toLowerCase()).not.toContain("hex");
    expect(placeholder?.toLowerCase()).not.toContain("char");
  });

  test("typing is reported back to the owner verbatim (untrimmed)", () => {
    let seen: string | undefined;
    const field = findOne({ onValue: (v) => (seen = v) }, Input);
    (field.props.onInput as (v: string) => void)("  tok  ");
    expect(seen).toBe("  tok  ");
  });
});

describe("TokenGate — submitting", () => {
  test("the CTA reads Unlock and is primary", () => {
    const btn = findOne({}, Button);
    expect(btn.props.variant).toBe("pri");
    expect(btn.props.children).toBe("Unlock");
  });

  test.each([
    ["empty", "", true],
    ["whitespace only", "   \t ", true],
    ["a token", "abc", false],
    ["a padded token", "  abc  ", false],
  ])("%s ⇒ disabled=%p", (_name, value, disabled) => {
    expect(findOne({ value }, Button).props.disabled).toBe(disabled);
  });

  test("clicking hands over the TRIMMED token", () => {
    const got: string[] = [];
    const btn = findOne({ value: "  s3cr3t\n", onSubmit: (t) => got.push(t) }, Button);
    (btn.props.onClick as () => void)();
    expect(got).toEqual(["s3cr3t"]);
  });

  test("an empty field cannot submit even if the click closure is invoked", () => {
    const got: string[] = [];
    const btn = findOne({ value: "   ", onSubmit: (t) => got.push(t) }, Button);
    (btn.props.onClick as () => void)();
    expect(got).toEqual([]);
  });

  test("Enter submits the trimmed token", () => {
    const got: string[] = [];
    let prevented = 0;
    const field = findOne({ value: " tok ", onSubmit: (t) => got.push(t) }, Input);
    (field.props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault: () => prevented++ });
    expect(got).toEqual(["tok"]);
    expect(prevented).toBe(1);
  });

  test("Enter on an empty field submits nothing, but is still swallowed", () => {
    const got: string[] = [];
    let prevented = 0;
    const field = findOne({ value: "  ", onSubmit: (t) => got.push(t) }, Input);
    (field.props.onKeyDown as (e: unknown) => void)({ key: "Enter", preventDefault: () => prevented++ });
    expect(got).toEqual([]);
    expect(prevented).toBe(1);
  });

  test.each(["a", "Escape", "Tab", "ArrowDown"])("%s is left entirely alone", (key) => {
    const got: string[] = [];
    let prevented = 0;
    const field = findOne({ value: "tok", onSubmit: (t) => got.push(t) }, Input);
    (field.props.onKeyDown as (e: unknown) => void)({ key, preventDefault: () => prevented++ });
    expect(got).toEqual([]);
    expect(prevented).toBe(0);
  });
});

describe("TokenGate — the retrieval hint", () => {
  test("names the container verbatim, in both commands", () => {
    const out = html({ container: "mythical" });
    expect(out).toContain("Lost it? From a terminal on the host:");
    expect(out).toContain('<code class="token-entry__cmd">$ docker exec mythical bun run token</code>');
    expect(out).toContain(
      '<code class="token-entry__cmd">$ docker exec mythical bun run token -- --rotate</code>',
    );
  });

  test("a differently-named container flows straight through", () => {
    expect(html({ container: "ui-host-2" })).toContain("$ docker exec ui-host-2 bun run token");
  });

  test("says, in plain language, what rotating costs", () => {
    const out = html();
    expect(out).toContain("signs out every browser");
  });

  // A hint the operator cannot paste is WORSE than no hint: it is trusted, then it fails. One
  // product's CLI is not at its image's default WORKDIR and must drop from root to a service user,
  // so the simple form is unrunnable there and the container name alone cannot express it.
  test("a product whose invocation differs can override BOTH commands verbatim", () => {
    const retrieve = "docker exec -u svc box sh -c 'cd /opt/app && bun run token'";
    const rotate = "docker exec -u svc box sh -c 'cd /opt/app && bun run token -- --rotate'";
    const out = html({ container: "mythical", retrieveCommand: retrieve, rotateCommand: rotate });
    // Rendered as a TEXT node, where preact escapes `&` but leaves quotes alone (they only need
    // escaping inside attributes). A real command carries both, so this pins the actual encoding
    // rather than assuming it — a wrongly-escaped hint is one the operator cannot paste.
    const esc = (s: string) => s.replace(/&/g, "&amp;");
    expect(out).toContain(esc(retrieve));
    expect(out).toContain(esc(rotate));
    // The unrunnable default must be GONE, not merely accompanied by the correct one.
    expect(out).not.toContain("docker exec mythical bun run token");
  });

  test("overriding only one command leaves the other on its default", () => {
    const out = html({ container: "mythical", retrieveCommand: "custom-read" });
    expect(out).toContain("$ custom-read");
    expect(out).toContain("$ docker exec mythical bun run token -- --rotate");
  });
});

// ─── Copy to clipboard ──────────────────────────────────────────────────────────────────────────

const RETRIEVE = "docker exec mythical bun run token";
const ROTATE = "docker exec mythical bun run token -- --rotate";

/** Swaps `globalThis.navigator` for the duration of `fn`, restoring the real one after. Passing
 *  `undefined` removes it entirely — the shape a hardened/embedded host can genuinely present. */
async function withNavigator(stub: unknown, fn: () => Promise<void> | void): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  if (stub === undefined) delete (globalThis as { navigator?: unknown }).navigator;
  else Object.defineProperty(globalThis, "navigator", { value: stub, configurable: true, writable: true });
  try {
    await fn();
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  }
}

/** A clipboard whose `writeText` records what it was given and how it was called. */
function recordingClipboard(behavior: "resolve" | "reject" | "throw" = "resolve") {
  const wrote: string[] = [];
  const clipboard = {
    marker: "the real clipboard object",
    writeText(this: { marker?: string } | undefined, text: string) {
      // A native `writeText` is illegal torn off its receiver, so this pins that the shipped call
      // keeps it: a `const { writeText } = navigator.clipboard` refactor fails here, not in a
      // browser where it would silently become an "Illegal invocation" the user sees as nothing.
      expect(this?.marker).toBe("the real clipboard object");
      wrote.push(text);
      if (behavior === "throw") throw new Error("sync boom");
      if (behavior === "reject") return Promise.reject(new DOMException("Document is not focused."));
      return Promise.resolve();
    },
  };
  return { wrote, navigator: { clipboard } };
}

describe("copyToClipboard — the write is real, or it is a failure", () => {
  test("a resolved write ⇒ true, and the clipboard got the text VERBATIM", async () => {
    const stub = recordingClipboard("resolve");
    await withNavigator(stub.navigator, async () => {
      expect(await copyToClipboard(RETRIEVE)).toBe(true);
    });
    expect(stub.wrote).toEqual([RETRIEVE]);
  });

  test("a REJECTED write ⇒ false — never a success the operator cannot paste from", async () => {
    // the honest case this whole feature turns on: navigator.clipboard rejects when the document
    // is not focused, and is denied outright by a permissions policy.
    const stub = recordingClipboard("reject");
    await withNavigator(stub.navigator, async () => {
      expect(await copyToClipboard(RETRIEVE)).toBe(false);
    });
  });

  test("a write that throws SYNCHRONOUSLY ⇒ false, and does not escape", async () => {
    const stub = recordingClipboard("throw");
    await withNavigator(stub.navigator, async () => {
      expect(await copyToClipboard(RETRIEVE)).toBe(false);
    });
  });

  test.each([
    ["no clipboard at all — an http:// LAN address is not a secure context", { navigator: {} }],
    ["a clipboard object with no writeText", { navigator: { clipboard: {} } }],
    ["a writeText that is not callable", { navigator: { clipboard: { writeText: "nope" } } }],
    ["no navigator at all", undefined],
  ])("%s ⇒ false", async (_name, stub) => {
    await withNavigator(stub === undefined ? undefined : (stub as { navigator: unknown }).navigator, async () => {
      expect(await copyToClipboard(RETRIEVE)).toBe(false);
    });
  });
});

describe("the copy control — state, naming, announcement", () => {
  const copied: CopyFeedback = { target: "retrieve", ok: true };
  const failed: CopyFeedback = { target: "retrieve", ok: false };

  test("only the control that was clicked shows an outcome", () => {
    expect(copyControlState("retrieve", copied)).toBe("copied");
    expect(copyControlState("rotate", copied)).toBe("idle");
    expect(copyControlState("retrieve", failed)).toBe("failed");
    expect(copyControlState("rotate", failed)).toBe("idle");
  });

  test.each([undefined, null])("no feedback (%p) ⇒ idle", (feedback) => {
    expect(copyControlState("retrieve", feedback)).toBe("idle");
  });

  test("each control names WHICH command it copies — two buttons called 'Copy' name nothing", () => {
    const retrieve = copyButtonLabel("retrieve");
    const rotate = copyButtonLabel("rotate");
    expect(retrieve).not.toBe(rotate);
    expect(retrieve).toContain("retrieval");
    expect(rotate).toContain("rotation");
  });

  test.each<[CopyTarget, CopyFeedback | undefined]>([
    ["retrieve", undefined],
    ["retrieve", { target: "retrieve", ok: true }],
    ["retrieve", { target: "retrieve", ok: false }],
    ["rotate", undefined],
    ["rotate", { target: "rotate", ok: true }],
    ["rotate", { target: "rotate", ok: false }],
  ])("%s/%o — the name states the current state and stays distinct per command", (target, feedback) => {
    // the control is an icon, so the NAME is the only thing carrying the state to a reader
    const name = copyButtonLabel(target, feedback);
    expect(name).toContain(COPY_WORD[copyControlState(target, feedback)]);
    expect(name).not.toBe(copyButtonLabel(target === "retrieve" ? "rotate" : "retrieve", feedback));
  });

  test("the three states produce three DIFFERENT names, per command", () => {
    for (const target of ["retrieve", "rotate"] as const) {
      const names = [
        copyButtonLabel(target),
        copyButtonLabel(target, { target, ok: true }),
        copyButtonLabel(target, { target, ok: false }),
      ];
      expect(new Set(names).size).toBe(3);
    }
  });

  test("a failed control's name says what to do instead", () => {
    expect(copyButtonLabel("retrieve", failed)).toContain("copy it manually");
  });

  test("the announcement is empty at rest, and never claims a copy that did not happen", () => {
    expect(copyStatusLine()).toBe("");
    expect(copyStatusLine(null)).toBe("");
    expect(copyStatusLine(copied)).toBe("Copied the token-retrieval command to the clipboard.");
    const line = copyStatusLine(failed);
    expect(line).toContain("Could not copy");
    expect(line).toContain("copy it manually");
    expect(line).not.toContain("Copied");
  });

  test("the button is a real <button type=button>, not a div with a click handler", () => {
    const out = renderToString(<CopyCommandButton target="retrieve" command={RETRIEVE} />);
    expect(out).toContain("<button");
    expect(out).toContain('type="button"');
  });

  test.each<[string, CopyFeedback | undefined, string, string]>([
    ["at rest", undefined, "Copy the token-retrieval command", 'class="token-entry__copy"'],
    [
      "after a success",
      { target: "retrieve", ok: true },
      "Copied the token-retrieval command",
      "token-entry__copy is-copied",
    ],
    [
      "after a failure",
      { target: "retrieve", ok: false },
      "Copy failed for the token-retrieval command",
      "token-entry__copy is-failed",
    ],
  ])("%s the control is named %p and carries %p", (_name, feedback, name, cls) => {
    // the control is an icon: its STATE lives in the accessible name and the class, never in text
    const out = renderToString(
      <CopyCommandButton target="retrieve" command={RETRIEVE} feedback={feedback} />,
    );
    expect(out).toContain(`aria-label="${name}`);
    expect(out).toContain(cls);
    // no text node at all inside the button
    expect(out).toMatch(/<button[^>]*><svg[\s\S]*<\/svg><\/button>/);
  });

  test("the tooltip says the same thing as the accessible name — never something else", () => {
    for (const feedback of [undefined, { target: "retrieve" as const, ok: true }, { target: "retrieve" as const, ok: false }]) {
      const out = renderToString(
        <CopyCommandButton target="retrieve" command={RETRIEVE} feedback={feedback} />,
      );
      const label = out.match(/aria-label="([^"]*)"/)?.[1];
      const title = out.match(/title="([^"]*)"/)?.[1];
      expect(label).toBeTruthy();
      expect(title).toBe(label!);
    }
  });
});

describe("the copy icon — an inline SVG, three distinct SHAPES", () => {
  // An inline <svg> carries its own outlines, so unlike a font glyph (⧉ and friends) it cannot
  // render as tofu against the family's SUBSETTED mono face.
  test("it is inline vector paths, not a character", () => {
    const out = renderToString(<CopyIcon state="idle" />);
    expect(out).toContain("<svg");
    expect(out).toContain('viewBox="0 0 16 16"');
    expect((out.match(/<path /g) ?? []).length).toBe(COPY_ICON_PATHS.idle.length);
    // no text node inside the mark — nothing that could depend on a font
    expect(out).toMatch(/^<svg[^>]*>(<path[^>]*><\/path>)+<\/svg>$/);
  });

  test("the mark is hidden from readers — the NAME lives on the button", () => {
    const out = renderToString(<CopyIcon state="idle" />);
    expect(out).toContain('aria-hidden="true"');
    expect(out).toContain('focusable="false"');
    expect(out).not.toContain("aria-label");
    expect(out).not.toContain("<title");
  });

  test("it takes its color from the control, so the state color needs no second rule", () => {
    expect(renderToString(<CopyIcon state="idle" />)).toContain('stroke="currentColor"');
  });

  // WCAG 1.4.1: color is never the only difference. A color-blind operator has to be able to tell
  // "copied" from "failed", and both from "not yet clicked".
  test("the three states are three different shapes, not one shape in three colors", () => {
    const shapes = (["idle", "copied", "failed"] as const).map((s) => COPY_ICON_PATHS[s].join("|"));
    expect(new Set(shapes).size).toBe(3);
    const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
    for (const [a, b] of pairs) expect(shapes[a]).not.toBe(shapes[b]);
  });

  test("each state renders ITS OWN path data", () => {
    for (const state of ["idle", "copied", "failed"] as const) {
      const out = renderToString(<CopyIcon state={state} />);
      for (const d of COPY_ICON_PATHS[state]) expect(out).toContain(`d="${d}"`);
      for (const other of ["idle", "copied", "failed"] as const) {
        if (other === state) continue;
        for (const d of COPY_ICON_PATHS[other]) expect(out).not.toContain(`d="${d}"`);
      }
    }
  });
});

describe("createCopyRunner — the sequencing, with no DOM and no real clock", () => {
  /** A runner wired to controllable writes and a hand-cranked clock. */
  function harness() {
    const published: (CopyFeedback | null)[] = [];
    const pending: ((ok: boolean) => void)[] = [];
    const timers = new Map<number, () => void>();
    let nextHandle = 1;
    const runner = createCopyRunner({
      copy: () => new Promise<boolean>((resolve) => pending.push(resolve)),
      setFeedback: (f) => published.push(f),
      setTimer: (fn) => {
        const h = nextHandle++;
        timers.set(h, fn);
        return h;
      },
      clearTimer: (h) => {
        timers.delete(h as number);
      },
    });
    return {
      runner,
      published,
      /** Settles the Nth write still outstanding, then lets the microtask queue drain. */
      settle: async (index: number, ok: boolean) => {
        pending[index]!(ok);
        await Promise.resolve();
        await Promise.resolve();
      },
      fireTimers: () => {
        for (const [h, fn] of [...timers]) {
          timers.delete(h);
          fn();
        }
      },
      liveTimers: () => timers.size,
      last: () => published[published.length - 1],
    };
  }

  test("a resolved write publishes the outcome, and it reverts on its own", async () => {
    const h = harness();
    void h.runner.run("retrieve", RETRIEVE);
    await h.settle(0, true);
    expect(h.last()).toEqual({ target: "retrieve", ok: true });
    expect(h.liveTimers()).toBe(1);
    h.fireTimers();
    expect(h.last()).toBeNull();
    expect(h.liveTimers()).toBe(0);
  });

  test("a failed write publishes ok:false — the revert path is identical", async () => {
    const h = harness();
    void h.runner.run("rotate", ROTATE);
    await h.settle(0, false);
    expect(h.last()).toEqual({ target: "rotate", ok: false });
    h.fireTimers();
    expect(h.last()).toBeNull();
  });

  test("a superseded run never reports, even when it settles LAST", async () => {
    // the older click rejects slowly, the newer one succeeds: the stale failure must not land on
    // top of the fresh success
    const h = harness();
    void h.runner.run("retrieve", RETRIEVE);
    void h.runner.run("rotate", ROTATE);
    await h.settle(1, true);
    expect(h.last()).toEqual({ target: "rotate", ok: true });
    await h.settle(0, false);
    expect(h.last()).toEqual({ target: "rotate", ok: true });
  });

  // REGRESSION GUARD: the previous outcome must not be left standing while a new write is in
  // flight, guarded only by the OLD run's revert timer — which by then refuses to fire. A second
  // write that hangs (a permission prompt left open never settles) would otherwise leave a stale
  // "Copied" on screen indefinitely, pointing at a clipboard that no longer matches it.
  test("starting a new run retires the previous outcome AT ONCE, even if the new write hangs", async () => {
    const h = harness();
    void h.runner.run("retrieve", RETRIEVE);
    await h.settle(0, true);
    expect(h.last()).toEqual({ target: "retrieve", ok: true });

    void h.runner.run("rotate", ROTATE); // never settles
    expect(h.last()).toBeNull();
    expect(h.liveTimers()).toBe(0); // the old run's timer is gone, not merely muzzled
    h.fireTimers();
    expect(h.last()).toBeNull();
  });

  test("dispose drops a pending revert timer (the unmount path)", async () => {
    const h = harness();
    void h.runner.run("retrieve", RETRIEVE);
    await h.settle(0, true);
    expect(h.liveTimers()).toBe(1);
    h.runner.dispose();
    expect(h.liveTimers()).toBe(0);
  });

  // REGRESSION GUARD: dispose must drop more than an ARMED timer. A write still in flight when
  // the card unmounts would otherwise go on to publish an outcome and arm a fresh timer that
  // nothing is left to clear.
  test("dispose retires an IN-FLIGHT write too — nothing is published after unmount", async () => {
    const h = harness();
    void h.runner.run("retrieve", RETRIEVE);
    const publishedBefore = h.published.length;
    h.runner.dispose();
    await h.settle(0, true);
    expect(h.published.length).toBe(publishedBefore);
    expect(h.liveTimers()).toBe(0);
  });

  test("the runner reports the write's REAL result — it never assumes", async () => {
    const seen: (CopyFeedback | null)[] = [];
    const runner = createCopyRunner({
      copy: async () => false,
      setFeedback: (f) => seen.push(f),
      setTimer: () => 1,
      clearTimer: () => {},
    });
    await runner.run("retrieve", RETRIEVE);
    expect(seen).toEqual([null, { target: "retrieve", ok: false }]);
  });
});

describe("TokenGate — the copy control on each command line", () => {
  test("both commands get their own control, and the command line is still rendered in full", () => {
    const out = html();
    expect((out.match(/class="token-entry__cmd-row"/g) ?? []).length).toBe(2);
    expect((out.match(/class="token-entry__copy"/g) ?? []).length).toBe(2);
    // additive, never a replacement: the text stays there to be read and hand-selected
    expect(out).toContain(`<code class="token-entry__cmd">$ ${RETRIEVE}</code>`);
    expect(out).toContain(`<code class="token-entry__cmd">$ ${ROTATE}</code>`);
  });

  test("the two controls are distinguishably labelled", () => {
    const labels = Array.from(html().matchAll(/aria-label="([^"]*)"/g)).map((m) => m[1]!);
    const copyLabels = labels.filter((l) => l.toLowerCase().startsWith("copy"));
    expect(copyLabels).toEqual([
      "Copy the token-retrieval command",
      "Copy the token-rotation command",
    ]);
  });

  // THE trap. `$ ` is a shell prompt this card draws; it is not part of the command. A clipboard
  // holding "$ docker exec …" hands the operator a line that fails the moment they paste it.
  test("what is handed to the clipboard is the RUNNABLE command — no `$ ` prompt", () => {
    const got: [CopyTarget, string][] = [];
    const buttons = findAll({ onCopy: (t, c) => got.push([t, c]) }, CopyCommandButton);
    expect(buttons.length).toBe(2);
    // The command the card hands each control is already prompt-free…
    expect(buttons.map((b) => b.props.command)).toEqual([RETRIEVE, ROTATE]);
    // …and so is what the control's own, shipped click closure passes on. The component vnode
    // carries no onClick (CopyCommandButton renders it), so call it as a plain function — it uses
    // no hooks — and drive the real handler off the <button> it returns.
    for (const b of buttons) {
      const inner = collect(
        (CopyCommandButton as unknown as (p: Record<string, unknown>) => VNode<Record<string, unknown>>)(
          b.props as Record<string, unknown>,
        ),
      ).filter((v) => v.type === "button");
      expect(inner.length).toBe(1);
      (inner[0]!.props.onClick as () => void)();
    }
    expect(got).toEqual([
      ["retrieve", RETRIEVE],
      ["rotate", ROTATE],
    ]);
    for (const [, command] of got) {
      expect(command.startsWith("$")).toBe(false);
      expect(command).toBe(command.trim());
    }
  });

  test("a product's OVERRIDDEN command is what gets copied, verbatim", () => {
    const retrieve = "docker exec -u svc box sh -c 'cd /opt/app && bun run token'";
    const got: string[] = [];
    const buttons = findAll(
      { retrieveCommand: retrieve, onCopy: (_t, c) => got.push(c) },
      CopyCommandButton,
    );
    const inner = collect(
      (CopyCommandButton as unknown as (p: Record<string, unknown>) => VNode<Record<string, unknown>>)(
        buttons[0]!.props as Record<string, unknown>,
      ),
    ).filter((v) => v.type === "button");
    (inner[0]!.props.onClick as () => void)();
    expect(got).toEqual([retrieve]);
  });

  test("clicking with no owner wired up is a no-op, not a crash", () => {
    const buttons = findAll({}, CopyCommandButton);
    const inner = collect(
      (CopyCommandButton as unknown as (p: Record<string, unknown>) => VNode<Record<string, unknown>>)(
        buttons[0]!.props as Record<string, unknown>,
      ),
    ).filter((v) => v.type === "button");
    expect(() => (inner[0]!.props.onClick as () => void)()).not.toThrow();
  });

  test("a success marks ONLY the control that was clicked", () => {
    const out = html({ copy: { target: "retrieve", ok: true } });
    expect(out).toContain("token-entry__copy is-copied");
    expect((out.match(/class="token-entry__copy is-/g) ?? []).length).toBe(1);
    const names = Array.from(out.matchAll(/aria-label="(Cop[^"]*)"/g)).map((m) => m[1]!);
    expect(names).toEqual([
      "Copied the token-retrieval command",
      "Copy the token-rotation command", // the other one is untouched
    ]);
    expect(out).toContain("Copied the token-retrieval command to the clipboard.");
  });

  // The honesty rule, end to end: a clipboard that REJECTS must not produce a success state
  // anywhere in the rendered card.
  test("a rejected clipboard write renders a failure — never 'Copied'", async () => {
    const stub = recordingClipboard("reject");
    let ok = true;
    await withNavigator(stub.navigator, async () => {
      ok = await copyToClipboard(RETRIEVE);
    });
    expect(ok).toBe(false);
    const out = html({ copy: { target: "retrieve", ok } });
    expect(out).toContain("token-entry__copy is-failed");
    expect(out).toContain('aria-label="Copy failed for the token-retrieval command');
    // the failure mark is its own SHAPE, not the copy mark in another color (WCAG 1.4.1)
    for (const d of COPY_ICON_PATHS.failed) expect(out).toContain(`d="${d}"`);
    for (const d of COPY_ICON_PATHS.copied) expect(out).not.toContain(`d="${d}"`);
    expect(out).not.toContain("is-copied");
    expect(out).not.toContain('aria-label="Copied');
    expect(out).not.toContain("Copied the token-retrieval command");
    expect(out).toContain("Could not copy the token-retrieval command.");
    // and the command is still there, in full, to be selected by hand
    expect(out).toContain(`<code class="token-entry__cmd">$ ${RETRIEVE}</code>`);
  });

  test("the announcement region is ALWAYS in the DOM, and empty at rest", () => {
    // a live region inserted at the moment it gains content is announced unreliably
    expect(html()).toContain('<span class="token-entry__copy-status" role="status"></span>');
  });
});

describe("TokenGate — the token never leaks into the markup", () => {
  const SECRET = "zzsecretvaluezz";

  test("it appears exactly once, as the input's own value", () => {
    const out = html({ value: SECRET, invalid: true, status: 401, reason: "bad token" });
    expect(out.split(SECRET).length - 1).toBe(1);
    expect(out).toContain(`value="${SECRET}"`);
  });

  test("no aria-* attribute and no title carries it", () => {
    const out = html({ value: SECRET });
    for (const m of out.matchAll(/aria-[a-z]+="([^"]*)"/g)) expect(m[1]).not.toContain(SECRET);
    // The copy controls' tooltips are the only title attributes on this card. The guard is that no
    // title may carry the TOKEN — it was written as a blanket "no title= at all" back when the card
    // had none, which is a proxy for the real rule, not the rule.
    const titles = Array.from(out.matchAll(/title="([^"]*)"/g)).map((m) => m[1]!);
    expect(titles.length).toBe(2);
    for (const t of titles) {
      expect(t).not.toContain(SECRET);
      expect(t.startsWith("Copy")).toBe(true);
    }
    // and no <title> ELEMENT anywhere either — an SVG <title> would become an accessible name
    expect(out).not.toContain("<title");
  });

  test("the field starts empty and hidden — the stateful wrapper never pre-fills it", () => {
    const out = renderToString(<TokenGate product="brokkr" container="mythical" onSubmit={noop} />);
    // preact-render-to-string emits an empty value as the bare attribute `value`
    expect(out).toContain('class="input mono" value placeholder=');
    expect(out).toContain('type="password"');
    expect(out).toContain('aria-pressed="false"');
    expect(out).toContain("btn--pri is-disabled");
  });
});
