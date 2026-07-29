// packages/react-ui/gap-wave.test.tsx — render contracts for the mockup gap wave: Stepper, Seg,
// Callout/HelpButton, and the Button's tone-line path. React twin of
// packages/preact-ui/gap-wave.test.tsx — the SAME assertions against the SAME core derivations,
// which is the parity guarantee (both bindings derive 100% of their class strings/glyphs from
// @mythicalos/ui-core and never hard-code an equivalent; see parity.test.tsx's rationale).

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BANNER_ICON,
  CALLOUT_TONES,
  CALLOUT_PARTS,
  HELP_GLYPH,
  HELP_LABEL,
  SEG_PARTS,
  STEPPER_PARTS,
  STEP_DONE_GLYPH,
  buttonClass,
  calloutClass,
  helpClass,
  segClass,
  segCountText,
  segOptionClass,
  stepClass,
  stepperClass,
  stepState,
} from "@mythicalos/ui-core/logic";
import { Button, Callout, HelpButton, Seg, Stepper } from "./src/index.ts";

const steps = [{ label: "Intent" }, { label: "Review" }, { label: "Seal" }];

describe("Stepper — the walk, classes and badges all come from ui-core", () => {
  test("state classes and badges match the core derivation for every step", () => {
    const html = renderToStaticMarkup(<Stepper steps={steps} current={2} />);
    expect(html).toContain(`class="${stepperClass()} "`);
    for (let i = 0; i < steps.length; i++) {
      expect(html).toContain(`class="${stepClass(stepState(i + 1, 2))}"`);
    }
    expect(html).toContain(STEP_DONE_GLYPH); // step 1 is done
    expect(html).toContain(">2<"); // the current step keeps its numeral
  });

  test("the current step — and only it — carries aria-current='step'", () => {
    const html = renderToStaticMarkup(<Stepper steps={steps} current={2} />);
    expect(html.match(/aria-current="step"/g) ?? []).toHaveLength(1);
  });

  test("a step is a <button> ONLY when the caller passes onSelect for it", () => {
    const none = renderToStaticMarkup(<Stepper steps={steps} current={2} />);
    expect(none).not.toContain("<button");
    const withNav = renderToStaticMarkup(
      <Stepper steps={[{ label: "Intent", onSelect: () => {} }, { label: "Review" }]} current={2} />,
    );
    expect(withNav.match(/<button/g) ?? []).toHaveLength(1);
    expect(withNav).toContain('type="button"');
  });

  test("bars render between steps, opt-in, and are decorative", () => {
    const bare = renderToStaticMarkup(<Stepper steps={steps} current={1} />);
    expect(bare).not.toContain(STEPPER_PARTS.bar);
    const barred = renderToStaticMarkup(<Stepper steps={steps} current={1} bars />);
    expect(barred.match(new RegExp(STEPPER_PARTS.bar, "g")) ?? []).toHaveLength(steps.length - 1);
  });

  test("the sm size step rides stepperClass", () => {
    const html = renderToStaticMarkup(<Stepper steps={steps} current={1} size="sm" />);
    expect(html).toContain(`class="${stepperClass("sm")} "`);
  });

  test("a non-array steps prop renders an empty row rather than crashing", () => {
    const html = renderToStaticMarkup(<Stepper steps={undefined as never} current={1} />);
    expect(html).toContain(stepperClass());
    expect(html).not.toContain(STEPPER_PARTS.dot);
  });
});

describe("Seg — tablist semantics, selection and the count contract from ui-core", () => {
  const options = [
    { key: "jobs", label: "Jobs" },
    { key: "gate", label: "Gate" },
  ];

  test("the track announces as a tablist and options as tabs", () => {
    const html = renderToStaticMarkup(<Seg options={options} value="jobs" label="Lens" />);
    expect(html).toContain(`class="${segClass()} "`);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Lens"');
    expect(html.match(/role="tab"/g) ?? []).toHaveLength(2);
  });

  test("the selected option — and only it — is is-on AND aria-selected", () => {
    const html = renderToStaticMarkup(<Seg options={options} value="gate" />);
    expect(html).toContain(`class="${segOptionClass({ selected: true })}"`);
    expect(html.match(/aria-selected="true"/g) ?? []).toHaveLength(1);
    expect(html.match(/aria-selected="false"/g) ?? []).toHaveLength(1);
  });

  test("grow rides segClass", () => {
    const html = renderToStaticMarkup(<Seg options={options} value="jobs" grow />);
    expect(html).toContain(`class="${segClass({ grow: true })} "`);
  });

  test("a count renders through segCountText; a malformed count renders nothing", () => {
    const withCount = renderToStaticMarkup(
      <Seg options={[{ key: "failed", label: "Failed", count: 3 }]} value="failed" />,
    );
    expect(withCount).toContain(`<span class="${SEG_PARTS.count}">${segCountText(3)}</span>`);
    const malformed = renderToStaticMarkup(
      <Seg options={[{ key: "x", label: "X", count: -1 }]} value="x" />,
    );
    expect(malformed).not.toContain(SEG_PARTS.count);
  });
});

describe("Callout — tones, the two title dresses, glyphs from the banner map", () => {
  test("tone → class is calloutClass(tone), verbatim, for every tone", () => {
    for (const tone of CALLOUT_TONES) {
      const html = renderToStaticMarkup(<Callout tone={tone}>body</Callout>);
      expect(html).toContain(`class="${calloutClass(tone)} "`);
    }
  });

  test("a title row carries the tone's BANNER_ICON glyph by default; an explicit glyph overrides", () => {
    const html = renderToStaticMarkup(
      <Callout tone="ok" title="Sealed.">
        body
      </Callout>,
    );
    expect(html).toContain(CALLOUT_PARTS.title);
    expect(html).toContain(BANNER_ICON.ok);
    const custom = renderToStaticMarkup(
      <Callout tone="ok" title="Sealed." glyph="★">
        body
      </Callout>,
    );
    expect(custom).toContain("★");
  });

  test("kicker renders the micro-uppercase dress; title WINS when a caller passes both", () => {
    const kicked = renderToStaticMarkup(
      <Callout tone="warn" kicker="Not carried over">
        rows
      </Callout>,
    );
    expect(kicked).toContain(CALLOUT_PARTS.kicker);
    expect(kicked).not.toContain(CALLOUT_PARTS.title);
    const both = renderToStaticMarkup(
      <Callout tone="warn" title="T" kicker="K">
        body
      </Callout>,
    );
    expect(both).toContain(CALLOUT_PARTS.title);
    expect(both).not.toContain(CALLOUT_PARTS.kicker);
  });

  test("body always renders; the actions row only when passed", () => {
    const bare = renderToStaticMarkup(<Callout>help text</Callout>);
    expect(bare).toContain(CALLOUT_PARTS.body);
    expect(bare).not.toContain(CALLOUT_PARTS.acts);
    const acted = renderToStaticMarkup(
      <Callout actions={<Button variant="acc">Go</Button>}>b</Callout>,
    );
    expect(acted).toContain(CALLOUT_PARTS.acts);
    expect(acted).toContain(`class="${buttonClass("acc", {})}"`);
  });
});

describe("HelpButton — the round opener announces exactly what it paints", () => {
  test("closed and open states ride helpClass, with aria-expanded in lockstep", () => {
    const closed = renderToStaticMarkup(<HelpButton />);
    expect(closed).toContain(`class="${helpClass()} "`);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain(HELP_GLYPH);
    const open = renderToStaticMarkup(<HelpButton open />);
    expect(open).toContain(`class="${helpClass({ open: true })} "`);
    expect(open).toContain('aria-expanded="true"');
  });

  test("the accessible name defaults to the pages' wording and is overridable", () => {
    expect(renderToStaticMarkup(<HelpButton />)).toContain(`aria-label="${HELP_LABEL}"`);
    expect(renderToStaticMarkup(<HelpButton label="About the gate" />)).toContain(
      'aria-label="About the gate"',
    );
  });
});

describe("Button — the tone-line path", () => {
  test("variant='tone-line' + tone renders the outline mirror with data-tone", () => {
    for (const tone of ["ok", "warn", "info", "error"] as const) {
      const html = renderToStaticMarkup(
        <Button variant="tone-line" tone={tone}>
          Review
        </Button>,
      );
      expect(html).toContain(`class="${buttonClass("tone-line", {})}"`);
      expect(html).toContain(`data-tone="${tone}"`);
    }
  });

  test("bare tone-line degrades to the accent outline — no data-tone leaks", () => {
    const html = renderToStaticMarkup(<Button variant="tone-line">Edit</Button>);
    expect(html).toContain(`class="${buttonClass("tone-line", {})}"`);
    expect(html).not.toContain("data-tone");
  });

  test("the original tone-wins rule is untouched for every other variant", () => {
    const html = renderToStaticMarkup(
      <Button variant="pri" tone="warn">
        Go
      </Button>,
    );
    expect(html).toContain(`class="${buttonClass("tone", {})}"`);
    expect(html).toContain('data-tone="warn"');
  });

  test("an empty-string tone on tone-line normalizes to unset — never a variant/attribute mismatch", () => {
    const html = renderToStaticMarkup(
      <Button variant="tone-line" tone={"" as never}>
        Go
      </Button>,
    );
    expect(html).toContain(`class="${buttonClass("tone-line", {})}"`);
    expect(html).not.toContain("data-tone");
  });
});
