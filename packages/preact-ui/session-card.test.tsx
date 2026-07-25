/** @jsxImportSource preact */
// packages/preact-ui/session-card.test.tsx — render contract for the `session-card` atom (design
// registry spec v1). Expected class strings/geometry/text are derived by importing the CORE
// functions directly, never hard-coded, so this binding and @mythicalos/ui-core can never silently
// drift apart (same discipline as atoms.test.tsx).
//
// It also carries this component's share of the two package-wide scans, so the shared
// styles.test.tsx (which five parallel branches are also touching) needs no edit: every class this
// component emits must resolve in ui-core's styles.css, and it must never emit an inline `style=`.
//
// The three honesty invariants are pinned at the RENDER level here — the logic-level proofs live in
// ui-core's test/logic/session-card.test.ts.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "preact-render-to-string";
import {
  ctxBand,
  ctxBarGeom,
  ctxMeterClass,
  ctxNoteText,
  ctxValueText,
  sessionCardClass,
  sessionStatus,
  sessionStatusClass,
  sessionSubline,
  spineNodeClass,
  CTX_THRESHOLDS_DEFAULT,
  CTX_UNKNOWN_TEXT,
} from "@mythicalos/ui-core/logic";
import { SessionCard } from "./src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");
const noop = () => {};

/** The design card's five enumerated states, plus the two unknown states the doctrine requires. */
function allRenders(): string[] {
  return [
    // default · nominal
    renderToString(
      <SessionCard
        name="Jacob"
        meta={["worker", "opus-4-8", "2h 14m"]}
        status={{ lifecycle: "active", activity: "working" }}
        contextPct={62}
        spine={{ distills: 3, savedTok: 41_200 }}
        onSelect={noop}
      />,
    ),
    // selected · warn ≥75%
    renderToString(
      <SessionCard
        name="Peter"
        meta={["pm", "sonnet-5", "4h 02m"]}
        status={{ lifecycle: "active" }}
        contextPct={83}
        spine={{ distills: 1, savedTok: 12_800 }}
        selected
        onSelect={noop}
      />,
    ),
    // error ≥90%
    renderToString(
      <SessionCard name="Rasmus" meta={["worker", "opus-4-8", "6h 41m"]} contextPct={94} spine={{ distills: 2 }} />,
    ),
    // idle · queued work
    renderToString(
      <SessionCard
        name="Hanna"
        meta={["reviewer", "opus-4-8", "queued: 1 ON-DONE"]}
        status={{ lifecycle: "active", activity: "idle" }}
        contextPct={12}
      />,
    ),
    // disconnected · stale
    renderToString(
      <SessionCard
        name="Mike"
        meta={["architect", "last seen 00:12 ago"]}
        status={{ lifecycle: "active", connected: false }}
        contextPct={47}
        statusLabel="wake unavailable"
      />,
    ),
    // unknown context + unknown activity (not in the prototype's five — the doctrine's states)
    renderToString(<SessionCard name="Sif" meta={["worker"]} />),
    renderToString(<SessionCard name="" status={{ lifecycle: "failed" }} contextPct={100} />),
    // every remaining lifecycle, so the whole tone axis is covered by the scans below
    ...(["spawning", "stopping", "stopped", "paused"] as const).map((lifecycle) =>
      renderToString(<SessionCard name="X" status={{ lifecycle }} contextPct={5} />),
    ),
  ];
}

describe("SessionCard — the design card's container states", () => {
  test("container class comes from ui-core's sessionCardClass; selected and stale can combine", () => {
    const plain = renderToString(<SessionCard name="Jacob" />);
    expect(plain).toContain(`class="${sessionCardClass()}"`);

    const selectedStale = renderToString(
      <SessionCard name="Mike" status={{ lifecycle: "active", connected: false }} selected onSelect={noop} />,
    );
    expect(selectedStale).toContain(`class="${sessionCardClass({ selected: true, stale: true })}"`);
  });

  test("stale is DERIVED from a down link, and the prop can only ADD it — never remove it", () => {
    const derived = renderToString(<SessionCard name="M" status={{ lifecycle: "active", connected: false }} />);
    expect(derived).toContain(sessionCardClass({ stale: true }));

    const productClaim = renderToString(<SessionCard name="M" stale />);
    expect(productClaim).toContain(sessionCardClass({ stale: true }));

    // a disconnected session painted as live (solid border, unmuted values) is exactly the lie
    // this treatment exists to prevent — `stale={false}` must not buy it
    const attemptedSuppression = renderToString(
      <SessionCard name="M" status={{ lifecycle: "active", connected: false }} stale={false} />,
    );
    expect(attemptedSuppression).toContain(sessionCardClass({ stale: true }));

    const live = renderToString(<SessionCard name="M" status={{ lifecycle: "active" }} stale={false} />);
    expect(live).not.toContain("is-stale");
  });

  test("a blank status-label override falls back to the derived word (never colour alone)", () => {
    const derived = sessionStatus({ lifecycle: "spawning" });
    for (const override of ["", "   "]) {
      expect(renderToString(<SessionCard name="J" status={{ lifecycle: "spawning" }} statusLabel={override} />)).toContain(
        `>${derived.label}<`,
      );
    }
  });

  test("INVARIANT 2: statusLabel cannot launder an unreported session into a positive claim", () => {
    for (const laundering of ["idle", "working", "active"]) {
      const html = renderToString(<SessionCard name="J" statusLabel={laundering} />);
      expect(html).toContain(">unknown<");
      expect(html).not.toContain(`>${laundering}<`);
      expect(html).toContain(sessionStatusClass(sessionStatus()));
    }
  });

  test("a card with onSelect is a real button (aria-pressed carries the selection); without, a div", () => {
    const interactive = renderToString(<SessionCard name="J" selected onSelect={noop} />);
    expect(interactive).toContain('<button type="button"');
    expect(interactive).toContain('aria-pressed="true"');
    expect(renderToString(<SessionCard name="J" onSelect={noop} />)).toContain('aria-pressed="false"');
    expect(renderToString(<SessionCard name="J" />)).toContain("<div class=");
  });

  test("an extra class prop is appended alongside the core-derived classes", () => {
    expect(renderToString(<SessionCard name="J" class="rail-extra" />)).toContain(
      `class="${sessionCardClass({ extra: "rail-extra" })}"`,
    );
    // …and the whole attribute is core-derived: no stray separator when there is no extra class
    expect(renderToString(<SessionCard name="J" />)).toContain(`class="${sessionCardClass()}"`);
  });
});

describe("SessionCard — identity line", () => {
  test("name, avatar initial (the packaged Avatar atom) and the composed subline", () => {
    const html = renderToString(<SessionCard name="Jacob" meta={["worker", undefined, "2h 14m"]} />);
    expect(html).toContain("my-avatar__initials");
    expect(html).toContain(">J<");
    expect(html).toContain(sessionSubline(["worker", undefined, "2h 14m"]));
    expect(html).toContain("worker · 2h 14m");
  });

  test("an all-absent meta list omits the subline element entirely (no empty row)", () => {
    expect(renderToString(<SessionCard name="Jacob" />)).not.toContain("my-session-card__meta");
    expect(renderToString(<SessionCard name="Jacob" meta={[undefined, "  "]} />)).not.toContain(
      "my-session-card__meta",
    );
  });

  test("status class + words come from ui-core; the product may override only the words", () => {
    const derived = sessionStatus({ lifecycle: "spawning" });
    const html = renderToString(<SessionCard name="J" status={{ lifecycle: "spawning" }} />);
    expect(html).toContain(`class="${sessionStatusClass(derived)}"`);
    expect(html).toContain(derived.label);

    const overridden = renderToString(
      <SessionCard name="M" status={{ lifecycle: "active", connected: false }} statusLabel="wake unavailable" />,
    );
    // the words change, the derived tone/pulse/stale treatment does not
    expect(overridden).toContain("wake unavailable");
    expect(overridden).toContain(sessionStatusClass(sessionStatus({ lifecycle: "active", connected: false })));
    expect(overridden).toContain("is-stale");
  });
});

describe("SessionCard — INVARIANT 1: absence is not zero, on every render path", () => {
  test("no reading ⇒ NO fill element at all, and the value is '—' rather than '0%'", () => {
    const html = renderToString(<SessionCard name="Sif" />);
    expect(html).not.toContain("my-session-card__ctx-fill");
    expect(html).toContain(ctxMeterClass({ band: "unknown" }));
    expect(html).toContain(ctxValueText(undefined));
    expect(html).toContain(ctxNoteText("unknown"));
    expect(html).not.toContain(">0%<");
  });

  test("a null reading takes the same path as undefined", () => {
    const html = renderToString(<SessionCard name="Sif" contextPct={null} />);
    expect(html).not.toContain("my-session-card__ctx-fill");
    expect(html).toContain(ctxValueText(null));
  });

  test("the unknown meter is visually distinct from a healthy one (different band class)", () => {
    const unknown = renderToString(<SessionCard name="Sif" />);
    const healthy = renderToString(<SessionCard name="Sif" contextPct={12} />);
    expect(unknown).toContain(ctxMeterClass({ band: "unknown" }));
    expect(healthy).toContain(ctxMeterClass({ band: "ok" }));
    expect(unknown).not.toContain(ctxMeterClass({ band: "ok" }));
  });

  test("a REPORTED zero still renders a confident 0% (the rule cuts both ways)", () => {
    const html = renderToString(<SessionCard name="Sif" contextPct={0} />);
    expect(html).toContain('width="0"');
    expect(html).toContain(ctxValueText(0));
    expect(html).toContain(ctxMeterClass({ band: "ok" }));
  });

  test("an unreported spine omits the strip; an unreported saving still shows '—'", () => {
    expect(renderToString(<SessionCard name="J" />)).not.toContain("my-session-card__spine");
    expect(renderToString(<SessionCard name="J" spine={{}} />)).not.toContain("my-session-card__spine");
    // a REPORTED context value, so the meter's own "—" cannot stand in for the spine's
    const partial = renderToString(<SessionCard name="J" contextPct={62} spine={{ distills: 2 }} />);
    expect(partial).toContain("my-session-card__spine");
    expect(partial).toContain("spine · 2 distills");
    expect(partial).toContain(`<b class="my-session-card__spine-value">${CTX_UNKNOWN_TEXT}</b>`);
    expect(partial).not.toContain("0 tok");
    expect(partial).not.toContain(CTX_UNKNOWN_TEXT + "%");
    // …and a reported saving really does render in that same slot
    expect(renderToString(<SessionCard name="J" contextPct={62} spine={{ distills: 2, savedTok: 28_400 }} />)).toContain(
      '<b class="my-session-card__spine-value">−28.4k tok</b>',
    );
  });

  test("the spine strip's nodes/segments match ui-core's summary exactly", () => {
    const html = renderToString(<SessionCard name="J" spine={{ distills: 3, savedTok: 41_200 }} />);
    expect(html.split(spineNodeClass({ tip: false }) + '"').length - 1).toBe(3);
    expect(html).toContain(spineNodeClass({ tip: true }));
    expect(html.split("my-session-card__spine-seg").length - 1).toBe(3);
    expect(html).toContain("−41.2k tok");
  });
});

describe("SessionCard — INVARIANT 2: unknown is not idle, on every render path", () => {
  test("active with NO activity signal renders the lifecycle word, never 'idle'/'working'", () => {
    const html = renderToString(<SessionCard name="J" status={{ lifecycle: "active" }} />);
    expect(html).toContain(`class="${sessionStatusClass(sessionStatus({ lifecycle: "active" }))}"`);
    expect(html).toContain(">active<");
    expect(html).not.toContain(">idle<");
    expect(html).not.toContain(">working<");
  });

  test("nothing reported renders the distinct unknown tone/word, not the idle one", () => {
    const unknown = renderToString(<SessionCard name="J" />);
    const idle = renderToString(<SessionCard name="J" status={{ activity: "idle" }} />);
    expect(unknown).toContain(`class="${sessionStatusClass(sessionStatus())}"`);
    expect(unknown).toContain(">unknown<");
    expect(unknown).not.toContain(">idle<");
    expect(idle).toContain(">idle<");
    expect(idle).not.toContain(sessionStatusClass(sessionStatus()));
  });
});

describe("SessionCard — INVARIANT 3: the thresholds reach the render as props", () => {
  test("the ticks and the band both follow a product's retuned thresholds", () => {
    const tuned = { warn: 40, critical: 80 };
    const html = renderToString(<SessionCard name="J" contextPct={45} thresholds={tuned} />);
    for (const t of ctxBarGeom(45, tuned).ticks) expect(html).toContain(`x="${t.x}"`);
    expect(html).toContain(ctxMeterClass({ band: "warn" }));
    expect(html).toContain(ctxNoteText("warn"));
    // the same reading is merely "ok" under the defaults
    expect(renderToString(<SessionCard name="J" contextPct={45} />)).toContain(ctxMeterClass({ band: "ok" }));
  });

  test("the default ticks are the design card's fixed 75/90", () => {
    const html = renderToString(<SessionCard name="J" contextPct={62} />);
    expect(ctxBarGeom(62, CTX_THRESHOLDS_DEFAULT).ticks.map((t) => t.pct)).toEqual([75, 90]);
    for (const t of ctxBarGeom(62).ticks) expect(html).toContain(`x="${t.x}"`);
  });

  test("the fill width is ui-core's geometry, verbatim, across the range", () => {
    for (const pct of [0, 12, 47, 62, 74, 75, 83, 89, 90, 94, 100, 150]) {
      const html = renderToString(<SessionCard name="J" contextPct={pct} />);
      expect(html).toContain(`width="${ctxBarGeom(pct).fill}"`);
      expect(html).toContain(ctxValueText(pct));
    }
  });
});

describe("SessionCard — package-wide scans (this component's share)", () => {
  const renders = allRenders();

  test("renders emit a real class surface", () => {
    expect(renders.length).toBeGreaterThan(5);
    expect(renders.join("")).toContain("my-session-card");
  });

  test("every class this component emits resolves to ≥1 selector in ui-core's styles.css", () => {
    const emitted = new Set<string>();
    for (const html of renders) {
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
      }
    }
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const missing = [...emitted].filter((c) => !new RegExp(`\\.${escapeRe(c)}(?![\\w-])`).test(css));
    expect(missing).toEqual([]);
  });

  test("no render ever emits an inline style attribute (CSP style-src 'self')", () => {
    for (const html of renders) expect(html).not.toContain("style=");
  });
});

describe("SessionCard — the design card's warn/error states (spec states 2 and 3)", () => {
  test("a hot context replaces the status line, in the band's hue", () => {
    const high = renderToString(
      <SessionCard name="Peter" meta={["pm", "sonnet-5", "4h 02m"]} status={{ lifecycle: "active" }} contextPct={83} />,
    );
    expect(high).toContain(">context high<");
    expect(high).toContain(`class="${sessionStatusClass(sessionStatus({ lifecycle: "active" }, "warn"))}"`);
    expect(high).not.toContain(">active<");

    const critical = renderToString(<SessionCard name="Rasmus" status={{ lifecycle: "active" }} contextPct={94} />);
    expect(critical).toContain(">context critical<");
    expect(critical).toContain(sessionStatusClass(sessionStatus({ lifecycle: "active" }, "error")));
  });

  test("the status the card renders is derived from the SAME band the meter is drawn from", () => {
    for (const pct of [12, 62, 74, 75, 83, 89, 90, 94, 100]) {
      const html = renderToString(<SessionCard name="J" status={{ lifecycle: "active" }} contextPct={pct} />);
      const band = ctxBand(pct);
      expect(html).toContain(`class="${sessionStatusClass(sessionStatus({ lifecycle: "active" }, band))}"`);
      expect(html).toContain(ctxMeterClass({ band, stale: false }));
    }
  });

  test("INVARIANT 1: an unmeasured context never escalates the status line", () => {
    const html = renderToString(<SessionCard name="J" status={{ lifecycle: "active" }} />);
    expect(html).toContain(">active<");
    expect(html).not.toContain("context high");
    expect(html).not.toContain("context critical");
  });

  test("INVARIANT 2: statusLabel cannot pin an activity on a session that never claimed one", () => {
    for (const laundering of ["idle", "currently idle", "working now"]) {
      const html = renderToString(<SessionCard name="J" status={{ lifecycle: "active" }} statusLabel={laundering} />);
      expect(html).toContain(">active<");
      expect(html).not.toContain(`>${laundering}<`);
    }
    // a session that DID claim it can word it freely
    expect(
      renderToString(<SessionCard name="J" status={{ activity: "idle" }} statusLabel="idle since 10:02" />),
    ).toContain(">idle since 10:02<");
  });
});

describe("SessionCard — the displayed value and the band it is drawn in always agree", () => {
  test("a fractional reading is banded as REPORTED; the label grows a decimal rather than lying", () => {
    const html = renderToString(<SessionCard name="J" contextPct={89.5} />);
    expect(html).toContain(">89.5%<");
    expect(html).toContain(ctxMeterClass({ band: "warn" }));
    expect(html).not.toContain(">90%<");
  });

  test("across readings and product thresholds, the rendered number lands in the rendered band", () => {
    const thresholdSets = [undefined, { warn: 40, critical: 80 }];
    for (const thresholds of thresholdSets) {
      for (const pct of [0, 12.5, 39.6, 62, 74.5, 75, 89.5, 90, 94.2, 100]) {
        const html = renderToString(<SessionCard name="J" contextPct={pct} thresholds={thresholds} />);
        const shown = Number(ctxValueText(pct, thresholds).replace("%", ""));
        expect(html).toContain(`>${ctxValueText(pct, thresholds)}<`);
        expect(html).toContain(ctxMeterClass({ band: ctxBand(shown, thresholds), stale: false }));
        expect(html).toContain(ctxMeterClass({ band: ctxBand(pct, thresholds), stale: false }));
      }
    }
  });
});
