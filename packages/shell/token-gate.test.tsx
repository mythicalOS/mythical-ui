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
  TokenGate,
  TokenGateCard,
  TOKEN_GATE_BODY,
  TOKEN_GATE_INVALID_BODY,
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

function findOne(props: Partial<TokenGateCardProps>, type: unknown): VNode<Record<string, unknown>> {
  const hits = collect(callCard(props)).filter((v) => v.type === type);
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

  test("either half missing ⇒ undefined, never a padded line", () => {
    expect(authErrorLine(undefined, "invalid token")).toBeUndefined();
    expect(authErrorLine(401, undefined)).toBeUndefined();
    expect(authErrorLine()).toBeUndefined();
  });
});

describe("TokenGate — the card's structure, top to bottom", () => {
  test("renders inside a .token-entry card", () => {
    expect(html()).toContain('<div class="token-entry">');
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
    expect(out).not.toContain("title=");
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
