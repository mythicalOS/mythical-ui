// packages/react-ui/session-card.test.tsx — render contract for the `session-card` atom (design
// registry spec v1), and the parity proof against its Preact sibling: every expected class string,
// geometry value and word is derived by calling the SAME `@mythicalos/ui-core/logic` functions the
// component calls, so this binding cannot hard-code an equivalent and drift.
//
// The honesty invariants are pinned here too — a React consumer must get the same refusals to
// fabricate a zero or an idle claim as a Preact one.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
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
} from "@mythicalos/ui-core/logic";
import { SessionCard } from "./src/index.ts";

const css = readFileSync(join(import.meta.dir, "..", "ui-core", "styles.css"), "utf8");
const noop = () => {};

describe("SessionCard (React) — 100% derived from @mythicalos/ui-core/logic", () => {
  test("container class: every selected × stale combination is sessionCardClass, verbatim", () => {
    for (const selected of [false, true]) {
      for (const connected of [true, false]) {
        const html = renderToStaticMarkup(
          <SessionCard name="J" selected={selected} status={{ lifecycle: "active", connected }} />,
        );
        expect(html).toContain(`class="${sessionCardClass({ selected, stale: !connected })}"`);
      }
    }
  });

  test("status class + words are sessionStatusClass/sessionStatus, verbatim, for every input shape", () => {
    const inputs = [
      {},
      { lifecycle: "active" },
      { lifecycle: "active", activity: "working" },
      { lifecycle: "active", activity: "idle" },
      { lifecycle: "spawning" },
      { lifecycle: "stopping" },
      { lifecycle: "stopped" },
      { lifecycle: "failed" },
      { lifecycle: "paused" },
      { lifecycle: "active", connected: false },
      { connected: false },
    ] as const;
    for (const input of inputs) {
      const want = sessionStatus(input);
      const html = renderToStaticMarkup(<SessionCard name="J" status={input} />);
      expect(html).toContain(`class="${sessionStatusClass(want)}"`);
      expect(html).toContain(`>${want.label}<`);
    }
  });

  test("meter class, note, value and bar geometry match ui-core across the full range", () => {
    for (const pct of [0, 12, 47, 62, 74, 75, 83, 89, 90, 94, 100]) {
      const html = renderToStaticMarkup(<SessionCard name="J" contextPct={pct} />);
      const geom = ctxBarGeom(pct);
      expect(html).toContain(ctxMeterClass({ band: ctxBand(pct), stale: false }));
      expect(html).toContain(`width="${geom.fill}"`);
      expect(html).toContain(`>${ctxValueText(pct)}<`);
      expect(html).toContain(ctxNoteText(ctxBand(pct)));
      for (const t of geom.ticks) expect(html).toContain(`x="${t.x}"`);
    }
  });

  test("subline composition is sessionSubline, verbatim", () => {
    const meta = ["worker", undefined, "2h 14m"];
    expect(renderToStaticMarkup(<SessionCard name="J" meta={meta} />)).toContain(sessionSubline(meta));
  });

  test("spine strip nodes are spineNodeClass, verbatim", () => {
    const html = renderToStaticMarkup(<SessionCard name="J" spine={{ distills: 2, savedTok: 28_400 }} />);
    expect(html).toContain(spineNodeClass({ tip: false }));
    expect(html).toContain(spineNodeClass({ tip: true }));
    expect(html).toContain("spine · 2 distills");
    expect(html).toContain("−28.4k tok");
  });
});

describe("SessionCard (React) — the honesty invariants survive this binding too", () => {
  test("INVARIANT 1: no reading ⇒ no fill element, '—' rather than '0%', its own band class", () => {
    const html = renderToStaticMarkup(<SessionCard name="Sif" />);
    expect(html).not.toContain("my-session-card__ctx-fill");
    expect(html).toContain(ctxMeterClass({ band: "unknown" }));
    expect(html).toContain(`>${ctxValueText(undefined)}<`);
    expect(html).not.toContain(">0%<");
  });

  test("INVARIANT 1: an unreported spine is no strip; an unreported saving is '—'", () => {
    expect(renderToStaticMarkup(<SessionCard name="J" spine={{}} />)).not.toContain("my-session-card__spine");
    expect(renderToStaticMarkup(<SessionCard name="J" spine={{ distills: 1 }} />)).toContain(
      `>${ctxValueText(undefined)}<`,
    );
  });

  test("INVARIANT 2: active-but-no-activity renders the lifecycle word, never idle/working", () => {
    const html = renderToStaticMarkup(<SessionCard name="J" status={{ lifecycle: "active" }} />);
    expect(html).toContain(">active<");
    expect(html).not.toContain(">idle<");
    expect(html).not.toContain(">working<");
  });

  test("INVARIANT 2: nothing reported renders the distinct unknown tone, not the idle one", () => {
    const unknown = renderToStaticMarkup(<SessionCard name="J" />);
    expect(unknown).toContain(sessionStatusClass(sessionStatus()));
    expect(unknown).not.toContain(sessionStatusClass(sessionStatus({ activity: "idle" })));
    expect(unknown).toContain(">unknown<");
  });

  test("INVARIANT 3: a product's retuned thresholds drive both the band and the ticks", () => {
    const tuned = { warn: 40, critical: 80 };
    const html = renderToStaticMarkup(<SessionCard name="J" contextPct={45} thresholds={tuned} />);
    expect(html).toContain(ctxMeterClass({ band: "warn" }));
    for (const t of ctxBarGeom(45, tuned).ticks) expect(html).toContain(`x="${t.x}"`);
  });
});

describe("SessionCard (React) — interaction + package scans", () => {
  test("onSelect makes it a real button carrying the selection; without it, a div", () => {
    const interactive = renderToStaticMarkup(<SessionCard name="J" selected onSelect={noop} />);
    expect(interactive).toContain("<button");
    expect(interactive).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<SessionCard name="J" />)).toContain("<div");
  });

  test("every emitted class resolves in ui-core's styles.css, and nothing emits inline style", () => {
    const renders = [
      renderToStaticMarkup(
        <SessionCard
          name="Jacob"
          meta={["worker", "opus-4-8", "2h 14m"]}
          status={{ lifecycle: "active", activity: "working" }}
          contextPct={62}
          spine={{ distills: 3, savedTok: 41_200 }}
          selected
          onSelect={noop}
        />,
      ),
      renderToStaticMarkup(
        <SessionCard name="Mike" meta={["architect"]} status={{ lifecycle: "active", connected: false }} contextPct={47} />,
      ),
      renderToStaticMarkup(<SessionCard name="Sif" />),
      ...(["spawning", "stopping", "stopped", "failed", "paused"] as const).map((lifecycle) =>
        renderToStaticMarkup(<SessionCard name="X" status={{ lifecycle }} contextPct={94} />),
      ),
    ];
    const emitted = new Set<string>();
    for (const html of renders) {
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        for (const c of m[1]!.split(/\s+/)) if (c.length > 0) emitted.add(c);
      }
      expect(html).not.toContain("style=");
    }
    const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect([...emitted].filter((c) => !new RegExp(`\\.${escapeRe(c)}(?![\\w-])`).test(css))).toEqual([]);
  });
});

describe("SessionCard (React) — the stale/label rules come from ui-core, not from this binding", () => {
  test("`stale={false}` cannot paint a disconnected session as live", () => {
    const html = renderToStaticMarkup(
      <SessionCard name="M" status={{ lifecycle: "active", connected: false }} stale={false} />,
    );
    expect(html).toContain(sessionCardClass({ stale: true }));
    expect(renderToStaticMarkup(<SessionCard name="M" status={{ lifecycle: "active" }} stale />)).toContain(
      sessionCardClass({ stale: true }),
    );
  });

  test("a real status-label override wins; a blank one falls back to the derived word", () => {
    const down = sessionStatus({ lifecycle: "active", connected: false });
    expect(
      renderToStaticMarkup(
        <SessionCard name="M" status={{ lifecycle: "active", connected: false }} statusLabel="wake unavailable" />,
      ),
    ).toContain(">wake unavailable<");
    for (const override of ["", "  "]) {
      expect(
        renderToStaticMarkup(
          <SessionCard name="M" status={{ lifecycle: "active", connected: false }} statusLabel={override} />,
        ),
      ).toContain(`>${down.label}<`);
    }
  });

  test("INVARIANT 2: statusLabel cannot launder an unreported session into a positive claim", () => {
    for (const laundering of ["idle", "working"]) {
      const html = renderToStaticMarkup(<SessionCard name="J" statusLabel={laundering} />);
      expect(html).toContain(">unknown<");
      expect(html).not.toContain(`>${laundering}<`);
    }
  });

  test("a null thresholds value renders rather than throwing", () => {
    const html = renderToStaticMarkup(
      <SessionCard name="J" contextPct={95} thresholds={null as unknown as undefined} />,
    );
    expect(html).toContain(ctxMeterClass({ band: "error" }));
  });

  test("a fractional reading is banded as REPORTED, and the label grows a decimal to match", () => {
    const html = renderToStaticMarkup(<SessionCard name="J" contextPct={89.5} />);
    expect(html).toContain(">89.5%<");
    expect(html).toContain(ctxMeterClass({ band: "warn" }));
    expect(html).not.toContain(">90%<");
  });

  test("an unusable threshold pair falls back to the defaults in band AND ticks", () => {
    const broken = { warn: Number.NaN, critical: Number.NaN };
    const html = renderToStaticMarkup(<SessionCard name="J" contextPct={95} thresholds={broken} />);
    expect(html).toContain(ctxMeterClass({ band: "error" }));
    for (const t of ctxBarGeom(95, broken).ticks) expect(html).toContain(`x="${t.x}"`);
    expect(ctxBarGeom(95, broken).ticks.map((t) => t.pct)).toEqual([75, 90]);
  });
});

describe("SessionCard (React) — the context escalation and the reserved-word rule", () => {
  test("a hot context replaces the status line, in the band's hue", () => {
    for (const [pct, word] of [
      [83, "context high"],
      [94, "context critical"],
    ] as const) {
      const html = renderToStaticMarkup(<SessionCard name="J" status={{ lifecycle: "active" }} contextPct={pct} />);
      expect(html).toContain(`>${word}<`);
      expect(html).toContain(sessionStatusClass(sessionStatus({ lifecycle: "active" }, ctxBand(pct))));
    }
  });

  test("an unmeasured context never escalates, and statusLabel cannot pin an unmade claim", () => {
    const plain = renderToStaticMarkup(<SessionCard name="J" status={{ lifecycle: "active" }} />);
    expect(plain).toContain(">active<");
    expect(plain).not.toContain("context critical");
    const laundered = renderToStaticMarkup(
      <SessionCard name="J" status={{ lifecycle: "active" }} statusLabel="working" />,
    );
    expect(laundered).toContain(">active<");
    expect(laundered).not.toContain(">working<");
  });
});
