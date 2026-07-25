/** @jsxImportSource preact */
// packages/preact-ui/input-reveal.test.tsx — the Input atom's opt-in `revealable` show/hide
// affordance: the a11y contract of the toggle, the type swap, the "the value never leaves the
// input" rule, and the non-negotiable regression guard that an Input WITHOUT `revealable` still
// renders exactly the markup it rendered before the prop existed.
//
// Depth note (same technique nav-tabs.test.tsx / product-switcher.test.tsx document): this
// package's bun:test environment has no DOM, and preact-render-to-string never dispatches
// events, so the REVEALED state can't be reached by clicking. Both halves are still covered
// against the shipped code, not a reconstruction:
//   1. `InputBody` is `Input`'s hook-free body — the exact tree `Input` renders, with the reveal
//      state passed in — so rendering it directly proves what a revealed field looks like.
//   2. `RevealToggle` is likewise hook-free, so calling it as a plain function hands back the
//      real vnode with the real `onClick` closure attached, and invoking that closure runs the
//      shipped handler.
// Only the browser's event dispatch is missing.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import { useId } from "preact/hooks";
import type { VNode } from "preact";
import {
  Input,
  InputBody,
  RevealToggle,
  REVEAL_HIDE_LABEL,
  REVEAL_SHOW_LABEL,
  type RevealToggleProps,
} from "./src/Input.tsx";

const noop = () => {};

/** RevealToggle uses no hooks, so calling it directly returns the real vnode tree with the real
 *  onClick closure still attached. */
function callRevealToggle(props: RevealToggleProps): VNode<Record<string, unknown>> {
  return (RevealToggle as unknown as (p: RevealToggleProps) => VNode<Record<string, unknown>>)(props);
}

describe("Input — the default (no `revealable`) is byte-identical to the pre-feature markup", () => {
  // Frozen literals: these are the exact strings the pre-`revealable` Input produced (verified
  // against the previous implementation across these prop combinations). Three products already
  // ship this markup; a diff here is a consumer-visible regression, not a formatting nit.
  const FROZEN: Array<[string, VNode, string]> = [
    [
      "label + help",
      <Input label="Name" value="v" help="hint" />,
      '<label class="field"><span class="field-label">Name</span><input type="text" class="input" value="v" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"/><div class="help">hint</div></label>',
    ],
    [
      "error + mono + dirty",
      <Input value="v" error="bad value" mono dirty />,
      '<input type="text" class="input is-err mono is-dirty" value="v" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-invalid="true"/><div class="emsg"><span aria-hidden="true">⚠</span><span>bad value</span></div>',
    ],
    [
      "readOnly + disabled",
      <Input value="v" readOnly disabled />,
      '<input type="text" class="input readonly-input" value="v" disabled readonly autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"/>',
    ],
    [
      "type=password WITHOUT revealable — no toggle, no wrapper, no id",
      <Input label="UI token" type="password" value="v" mono />,
      '<label class="field"><span class="field-label">UI token</span><input type="password" class="input mono" value="v" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"/></label>',
    ],
  ];

  test.each(FROZEN)("%s", (_name, node, expected) => {
    expect(renderToString(node)).toBe(expected);
  });

  test("revealable on a NON-password field is inert — same markup as without it", () => {
    const withProp = renderToString(<Input label="Name" value="v" revealable />);
    const without = renderToString(<Input label="Name" value="v" />);
    expect(withProp).toBe(without);
    expect(withProp).not.toContain("input-reveal");
  });

  test("revealable={false} on a password field is inert", () => {
    const off = renderToString(<Input label="T" type="password" value="v" revealable={false} />);
    const absent = renderToString(<Input label="T" type="password" value="v" />);
    expect(off).toBe(absent);
    expect(off).not.toContain("input-reveal");
  });

  test("a plain Input calls NO hook — it does not consume preact's id sequence", () => {
    // `useId` draws from a per-render counter shared with every other component in the consumer's
    // tree. If Input took one unconditionally, adding this feature would silently renumber the
    // ids of unrelated components (a hydration-mismatch class of bug). Proof: an id-taking
    // sibling rendered after a plain Input must still get the FIRST id.
    const Probe = () => <i id={useId()} />;
    const withInput = renderToString(
      <div>
        <Input value="" />
        <Probe />
      </div>,
    );
    const withoutInput = renderToString(
      <div>
        <Probe />
      </div>,
    );
    const idOf = (html: string) => html.match(/<i id="([^"]+)"/)?.[1];
    expect(idOf(withInput)).toBe(idOf(withoutInput)!);
  });
});

describe("Input — revealable password field: the hidden (default) state", () => {
  const html = renderToString(
    <Input label="UI token" type="password" value="s3cr3t" mono revealable placeholder="paste…" />,
  );

  test("the field starts HIDDEN — revealing is always an explicit act", () => {
    expect(html).toContain('type="password"');
    expect(html).not.toContain('type="text"');
  });

  test("the toggle is a real <button type=\"button\"> — it can never submit a form", () => {
    expect(html).toContain('<button type="button" class="input-reveal__btn"');
  });

  test("its accessible name states the ACTION available now", () => {
    expect(html).toContain(`aria-label="${REVEAL_SHOW_LABEL}"`);
    expect(html).not.toContain(`aria-label="${REVEAL_HIDE_LABEL}"`);
  });

  test("its state is on aria-pressed, not implied by the label alone", () => {
    expect(html).toContain('aria-pressed="false"');
  });

  test("the visible text is contained in the accessible name (WCAG 2.5.3 label-in-name)", () => {
    expect(html).toContain(">show</button>");
    expect(REVEAL_SHOW_LABEL.toLowerCase()).toContain("show");
    expect(REVEAL_HIDE_LABEL.toLowerCase()).toContain("hide");
  });

  test("keyboard reachable and not a tab trap — no tabindex is set at all", () => {
    expect(html).not.toContain("tabindex");
  });

  test("a declared secret is not offered to the password manager", () => {
    // browsers largely ignore autocomplete=off on type=password: they autofill it and offer to
    // save it as a login. new-password is what actually suppresses both.
    expect(html).toContain('autocomplete="new-password"');
    // …and ONLY on this path — every other field keeps the atom's long-standing "off"
    expect(renderToString(<Input label="T" type="password" value="v" />)).toContain('autocomplete="off"');
    expect(renderToString(<Input label="T" value="v" />)).toContain('autocomplete="off"');
  });

  test("the label is bound by for/id, so the <button> is not inside a <label>", () => {
    // A <button> is a labelable element: nesting one in a <label> is invalid HTML and folds the
    // button's own accessible name into the input's. The reveal path uses an explicit pairing.
    expect(html).toContain('<div class="field">');
    expect(html).not.toContain('<label class="field">');
    const id = html.match(/<label class="field-label" for="([^"]+)">/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<input id="${id}"`);
    expect(html.indexOf("</label>")).toBeLessThan(html.indexOf("<button"));
  });

  test("an explicit id prop still wins over the generated one", () => {
    const withId = renderToString(
      <Input id="ui-token" label="UI token" type="password" revealable value="" />,
    );
    expect(withId).toContain('<label class="field-label" for="ui-token">');
    expect(withId).toContain('<input id="ui-token"');
  });

  test("no label ⇒ no field wrapper and no label element, but the toggle still renders", () => {
    const bare = renderToString(<Input type="password" value="v" revealable />);
    expect(bare).not.toContain("field-label");
    expect(bare).toContain("input-reveal__btn");
  });
});

describe("InputBody — the revealed state (reached without a DOM)", () => {
  const html = renderToString(
    <InputBody
      label="UI token"
      type="password"
      value="s3cr3t"
      mono
      revealable
      revealed
      onToggleReveal={noop}
      autoId="X1"
    />,
  );

  test("revealing swaps ONLY the effective input type", () => {
    expect(html).toContain('<input id="X1" type="text" class="input mono" value="s3cr3t"');
    expect(html).not.toContain('type="password"');
  });

  test("the accessible name and pressed state both flip", () => {
    expect(html).toContain(`aria-label="${REVEAL_HIDE_LABEL}"`);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(">hide</button>");
  });

  test("hidden and revealed differ ONLY in the type, the label, the pressed state and the glyph text", () => {
    const hidden = renderToString(
      <InputBody
        label="UI token"
        type="password"
        value="s3cr3t"
        mono
        revealable
        revealed={false}
        onToggleReveal={noop}
        autoId="X1"
      />,
    );
    const normalized = html
      .replace('type="text"', 'type="password"')
      .replace(`aria-label="${REVEAL_HIDE_LABEL}"`, `aria-label="${REVEAL_SHOW_LABEL}"`)
      .replace('aria-pressed="true"', 'aria-pressed="false"')
      .replace(">hide</button>", ">show</button>");
    expect(normalized).toBe(hidden);
  });
});

describe("the secret never reaches the DOM outside the input itself", () => {
  const SECRET = "zzsecretvaluezz";

  test.each([true, false])("revealed=%s — the value appears exactly once, in the input", (revealed) => {
    const html = renderToString(
      <InputBody
        label="UI token"
        type="password"
        value={SECRET}
        revealable
        revealed={revealed}
        onToggleReveal={noop}
        autoId="X1"
      />,
    );
    expect(html.split(SECRET).length - 1).toBe(1);
    expect(html).toContain(`value="${SECRET}"`);
    // and nothing in the toggle, the label, or any aria-* attribute carries it
    const button = html.slice(html.indexOf("<button"));
    expect(button).not.toContain(SECRET);
    for (const m of html.matchAll(/aria-[a-z]+="([^"]*)"/g)) expect(m[1]).not.toContain(SECRET);
    expect(html).not.toContain("title=");
  });

  test("help and error text still render, and still carry no value", () => {
    const html = renderToString(
      <InputBody
        label="UI token"
        type="password"
        value={SECRET}
        error="That token was not accepted."
        help="ignored while error is set"
        revealable
        revealed={false}
        onToggleReveal={noop}
        autoId="X1"
      />,
    );
    expect(html).toContain('<div class="emsg">');
    expect(html.split(SECRET).length - 1).toBe(1);
  });
});

describe("RevealToggle — the shipped click closure", () => {
  test("clicking runs the real onToggle", () => {
    let calls = 0;
    const vnode = callRevealToggle({ revealed: false, onToggle: () => calls++ });
    const onClick = vnode.props.onClick as () => void;
    expect(typeof onClick).toBe("function");
    onClick();
    onClick();
    expect(calls).toBe(2);
  });

  test("disabled ⇒ the button is disabled AND carries no click handler", () => {
    const vnode = callRevealToggle({ revealed: false, disabled: true, onToggle: noop });
    expect(vnode.props.disabled).toBe(true);
    expect(vnode.props.onClick).toBeUndefined();
    const html = renderToString(<RevealToggle revealed={false} disabled onToggle={noop} />);
    expect(html).toContain("disabled");
  });

  test("a disabled Input disables its toggle too", () => {
    const html = renderToString(
      <Input label="UI token" type="password" value="v" revealable disabled />,
    );
    expect(html).toContain('<button type="button" class="input-reveal__btn"');
    expect(html.slice(html.indexOf("<button"))).toContain("disabled");
  });
});
