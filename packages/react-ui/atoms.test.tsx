// packages/react-ui/atoms.test.tsx — render contracts for the 7 new atoms (React twin of
// packages/preact-ui/atoms.test.tsx: Chip, Card, Avatar, StatusLine, SearchInput, Banner, Gauge).
// Expected class strings/geometry are derived by importing the CORE functions directly
// (chipClass/statusLineClass/bannerClass/gaugeTone/gaugeGeom) rather than hard-coded literals, so
// this binding and @mythicalos/ui-core can never silently drift apart.

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  bannerClass,
  chipClass,
  gaugeGeom,
  gaugeTone,
  statusLineClass,
  type BannerTone,
  type ChipTone,
  type StatusTone,
} from "@mythicalos/ui-core/logic";
import { Avatar, Banner, Card, Chip, Gauge, SearchInput, StatusLine } from "./src/index.ts";

describe("Chip — tone → class string comes from ui-core's chipClass", () => {
  const tones: ChipTone[] = ["neutral", "accent", "ok", "warn", "error", "info"];
  test.each(tones)("tone=%s", (tone) => {
    const html = renderToStaticMarkup(<Chip tone={tone}>label</Chip>);
    expect(html).toContain(`class="${chipClass(tone)} "`);
  });
  test("defaults to neutral", () => {
    const html = renderToStaticMarkup(<Chip>label</Chip>);
    expect(html).toContain(`class="${chipClass("neutral")} "`);
  });
  test("an extra className prop is appended alongside the core-derived classes", () => {
    const html = renderToStaticMarkup(
      <Chip tone="ok" className="extra">
        label
      </Chip>,
    );
    expect(html).toContain(`class="${chipClass("ok")} extra"`);
  });
});

describe("StatusLine — tone → class string comes from ui-core's statusLineClass", () => {
  const tones: StatusTone[] = ["ok", "warn", "error", "info", "muted", "accent"];
  test.each(tones)("tone=%s", (tone) => {
    const html = renderToStaticMarkup(<StatusLine tone={tone}>state</StatusLine>);
    expect(html).toContain(`class="${statusLineClass(tone)}"`);
    expect(html).toContain("my-status__dot");
  });
  test("defaults to tone=ok", () => {
    const html = renderToStaticMarkup(<StatusLine>state</StatusLine>);
    expect(html).toContain(`class="${statusLineClass("ok")}"`);
  });
});

describe("Banner — tone → class string + default glyph come from ui-core", () => {
  const tones: BannerTone[] = ["warn", "info", "ok", "error"];
  test.each(tones)("tone=%s", (tone) => {
    const html = renderToStaticMarkup(<Banner tone={tone}>message</Banner>);
    expect(html).toContain(`class="${bannerClass(tone)}"`);
  });
  test("an explicit glyph overrides the tone's default icon", () => {
    const html = renderToStaticMarkup(
      <Banner tone="ok" glyph="★">
        done
      </Banner>,
    );
    expect(html).toContain("★");
  });
  test("defaults to tone=info", () => {
    const html = renderToStaticMarkup(<Banner>message</Banner>);
    expect(html).toContain(`class="${bannerClass("info")}"`);
  });
});

describe("Gauge — geometry + tone come from ui-core's gaugeGeom/gaugeTone", () => {
  test("dash offset/dasharray match gaugeGeom exactly", () => {
    const { circ, offset } = gaugeGeom(44, 4, 42);
    const html = renderToStaticMarkup(<Gauge pct={42} />);
    expect(html).toContain(`stroke-dasharray="${circ}"`);
    expect(html).toContain(`stroke-dashoffset="${offset}"`);
  });
  test.each([
    [10, "ok"],
    [74, "ok"],
    [75, "warn"],
    [89, "warn"],
    [90, "error"],
    [100, "error"],
  ] as const)("pct=%d → tone=%s (matches gaugeTone)", (pct, expected) => {
    expect(gaugeTone(pct)).toBe(expected);
    const html = renderToStaticMarkup(<Gauge pct={pct} />);
    expect(html).toContain(`my-gauge__fill--${expected}`);
  });
  test("the label shows the rounded, clamped percentage", () => {
    const over = renderToStaticMarkup(<Gauge pct={250} />);
    expect(over).toContain(">100%<");
    const under = renderToStaticMarkup(<Gauge pct={-30} />);
    expect(under).toContain(">0%<");
  });
  test("showLabel=false renders no label span", () => {
    const html = renderToStaticMarkup(<Gauge pct={50} showLabel={false} />);
    expect(html).not.toContain("my-gauge__label");
  });
});

describe("Card — structural render (no core derivation; flush is a literal modifier)", () => {
  test("title renders the eyebrow header", () => {
    const html = renderToStaticMarkup(<Card title="Section">body</Card>);
    expect(html).toContain("my-card__title");
    expect(html).toContain("Section");
  });
  test("no title ⇒ no eyebrow header", () => {
    const html = renderToStaticMarkup(<Card>body</Card>);
    expect(html).not.toContain("my-card__title");
  });
  test("flush appends the flush modifier", () => {
    const html = renderToStaticMarkup(<Card flush>rows</Card>);
    expect(html).toContain("my-card--flush");
  });
  test("flush=false (default) has no flush modifier", () => {
    const html = renderToStaticMarkup(<Card>rows</Card>);
    expect(html).not.toContain("my-card--flush");
  });
});

describe("Avatar — structural render", () => {
  test("renders the initials text", () => {
    const html = renderToStaticMarkup(<Avatar initials="HS" />);
    expect(html).toContain("my-avatar__initials");
    expect(html).toContain("HS");
  });
});

describe("SearchInput — structural render; clear button only when non-empty", () => {
  test("empty value ⇒ no clear button", () => {
    const html = renderToStaticMarkup(<SearchInput value="" />);
    expect(html).not.toContain("my-search__clear");
  });
  test("non-empty value ⇒ a type=button clear affordance (never type=submit)", () => {
    const html = renderToStaticMarkup(<SearchInput value="abc" onClear={() => {}} />);
    expect(html).toContain("my-search__clear");
    expect(html).toContain('<button type="button" class="my-search__clear"');
  });
  test("default placeholder is 'Search…'", () => {
    const html = renderToStaticMarkup(<SearchInput value="" />);
    expect(html).toContain("Search…");
  });
});
