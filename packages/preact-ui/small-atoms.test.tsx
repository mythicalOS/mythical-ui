/** @jsxImportSource preact */
// packages/preact-ui/small-atoms.test.tsx — render contracts for the three atoms extracted from a
// single product: SaveBar, StatTiles, GitChip. Expected class strings and copy are derived by
// importing the CORE functions/constants directly, never hard-coded, so the binding and
// @mythicalos/ui-core can never silently drift.

import { describe, expect, test } from "bun:test";
import { renderToString } from "preact-render-to-string";
import {
  GIT_BRANCH_GLYPH,
  GIT_BRANCH_UNKNOWN,
  GIT_CLEAN_LABEL,
  GIT_DETACHED_LABEL,
  GIT_LOADING_NOTE,
  GIT_STALE_LABEL,
  GIT_UNAVAILABLE_NOTE,
  SAVE_BAR_DISCARD_LABEL,
  SAVE_BAR_SAVE_LABEL,
  SAVE_BAR_PARTS,
  SAVE_BAR_SEP,
  STAT_TILE_PARTS,
  GIT_CHIP_PARTS,
  buttonClass,
  gitChipClass,
  gitFlagClass,
  saveBarClass,
  saveBarNote,
  statTileClass,
  statTilesClass,
  type GitStatus,
  type StatTile,
} from "@mythicalos/ui-core/logic";
import { GitChip, SaveBar, StatTiles } from "./src/index.ts";

const noop = () => {};

/** The renderer HTML-escapes text/attribute content, so copy carrying `&` (the card's
 *  "Save & apply") must be compared against its escaped form — not the raw constant. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("SaveBar", () => {
  test("renders the card's sentence, exactly as ui-core composes it", () => {
    const html = renderToString(<SaveBar changed={["Base URL"]} onDiscard={noop} onSave={noop} />);
    const note = saveBarNote(["Base URL"]);
    expect(html).toContain(`class="${saveBarClass()} "`);
    expect(html).toContain(note.countLabel);
    expect(html).toContain(note.detail);
    expect(html).toContain(SAVE_BAR_SEP);
    expect(html).toContain(`class="${SAVE_BAR_PARTS.count}"`);
  });

  test("pluralizes through ui-core, never locally", () => {
    const changed = ["Base URL", "Harness"];
    const html = renderToString(<SaveBar changed={changed} onDiscard={noop} onSave={noop} />);
    expect(html).toContain(saveBarNote(changed).countLabel);
  });

  test("NOT dirty ⇒ renders nothing (the card's 'only when dirty' rule, owned by the atom)", () => {
    expect(renderToString(<SaveBar changed={[]} onDiscard={noop} onSave={noop} />)).toBe("");
    expect(renderToString(<SaveBar changed={["", "  "]} onDiscard={noop} onSave={noop} />)).toBe("");
  });

  test("default action copy is the design card's; both are overridable", () => {
    const html = renderToString(<SaveBar changed={["X"]} onDiscard={noop} onSave={noop} />);
    expect(html).toContain(esc(SAVE_BAR_DISCARD_LABEL));
    expect(html).toContain(esc(SAVE_BAR_SAVE_LABEL));

    const custom = renderToString(
      <SaveBar changed={["X"]} saveLabel="Save locally" discardLabel="Reset" onDiscard={noop} onSave={noop} />,
    );
    expect(custom).toContain("Save locally");
    expect(custom).toContain("Reset");
    expect(custom).not.toContain(esc(SAVE_BAR_SAVE_LABEL));
  });

  test("the actions are the packaged Button atom: secondary discard + primary save", () => {
    const html = renderToString(<SaveBar changed={["X"]} onDiscard={noop} onSave={noop} />);
    expect(html).toContain(`class="${buttonClass("sec", {})}"`);
    expect(html).toContain(`class="${buttonClass("pri", {})}"`);
  });

  test("saving ⇒ the primary goes loading + inert, the discard stays live", () => {
    const html = renderToString(<SaveBar changed={["X"]} saving onDiscard={noop} onSave={noop} />);
    expect(html).toContain(`class="${buttonClass("pri", { loading: true })}"`);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`class="${buttonClass("sec", {})}"`);
  });

  test("an extra class is appended alongside the core-derived class", () => {
    const html = renderToString(
      <SaveBar changed={["X"]} class="extra" onDiscard={noop} onSave={noop} />,
    );
    expect(html).toContain(`class="${saveBarClass()} extra"`);
  });
});

describe("StatTiles", () => {
  const tiles: StatTile[] = [
    { label: "tokens in", value: "1,204,551", sub: "this session" },
    { label: "spine savings", value: "−212k", sub: "tokens distilled away", tone: "accent" },
    { label: "context", value: "91%", sub: "of window", tone: "error" },
  ];

  test("row + per-tile classes come from ui-core", () => {
    const html = renderToString(<StatTiles tiles={tiles} />);
    expect(html).toContain(`class="${statTilesClass()} "`);
    expect(html).toContain(`class="${statTileClass()}"`);
    expect(html).toContain(`class="${statTileClass("accent")}"`);
    expect(html).toContain(`class="${statTileClass("error")}"`);
  });

  test("label / value / sub each render into their own slot, in order", () => {
    const html = renderToString(<StatTiles tiles={[tiles[0] as StatTile]} />);
    expect(html).toContain(`<div class="${STAT_TILE_PARTS.label}">tokens in</div>`);
    expect(html).toContain(`<div class="${STAT_TILE_PARTS.value}">1,204,551</div>`);
    expect(html).toContain(`<div class="${STAT_TILE_PARTS.sub}">this session</div>`);
    expect(html.indexOf(STAT_TILE_PARTS.label)).toBeLessThan(html.indexOf(STAT_TILE_PARTS.value));
    expect(html.indexOf(STAT_TILE_PARTS.value)).toBeLessThan(html.indexOf(STAT_TILE_PARTS.sub));
  });

  test("a tile with no sub renders no sub element — the atom invents no caption", () => {
    const html = renderToString(<StatTiles tiles={[{ label: "cost", value: "$4.18" }]} />);
    expect(html).not.toContain(STAT_TILE_PARTS.sub);
  });

  test("an empty list renders the row and nothing else (no fabricated placeholder tiles)", () => {
    const html = renderToString(<StatTiles tiles={[]} />);
    expect(html).toContain(statTilesClass());
    expect(html).not.toContain(STAT_TILE_PARTS.value);
  });

  test("a non-array tiles prop renders an empty row rather than crashing", () => {
    const html = renderToString(<StatTiles tiles={undefined as unknown as StatTile[]} />);
    expect(html).toContain(statTilesClass());
    expect(html).not.toContain(STAT_TILE_PARTS.value);
  });

  test("duplicate labels do not collide", () => {
    const dupes: StatTile[] = [
      { label: "tokens", value: "1" },
      { label: "tokens", value: "2" },
    ];
    const html = renderToString(<StatTiles tiles={dupes} />);
    expect(html).toContain(">1<");
    expect(html).toContain(">2<");
  });
});

describe("GitChip — available arm", () => {
  const dirty: GitStatus = {
    branch: "feat/control-room-daemon-gaps",
    behind: 2,
    uncommitted: 4,
    unpushed: 1,
  };

  test("the card's dirty chip: branch + three flags with core-derived classes", () => {
    const html = renderToString(<GitChip status={dirty} />);
    expect(html).toContain(`class="${gitChipClass()} "`);
    expect(html).toContain(GIT_BRANCH_GLYPH);
    expect(html).toContain("feat/control-room-daemon-gaps");
    expect(html).toContain(`class="${gitFlagClass("warn")}"`);
    expect(html).toContain(`class="${gitFlagClass("error")}"`);
    expect(html).toContain("2↓ behind");
    expect(html).toContain("4 uncommitted");
    expect(html).toContain("1 unpushed");
  });

  test("the card's clean chip", () => {
    const html = renderToString(
      <GitChip status={{ branch: "main", behind: 0, uncommitted: 0, unpushed: 0 }} />,
    );
    expect(html).toContain(`class="${gitFlagClass("ok")}"`);
    expect(html).toContain(GIT_CLEAN_LABEL);
  });

  test("no upstream ⇒ those flags are absent, never rendered as a zero count", () => {
    const html = renderToString(
      <GitChip status={{ branch: "main", behind: null, uncommitted: 2, unpushed: null }} />,
    );
    expect(html).toContain("2 uncommitted");
    expect(html).not.toContain("behind");
    expect(html).not.toContain("unpushed");
  });

  test("a null branch reads 'detached HEAD', never a blank", () => {
    const html = renderToString(
      <GitChip status={{ branch: null, behind: 0, uncommitted: 0, unpushed: 0 }} />,
    );
    expect(html).toContain(GIT_DETACHED_LABEL);
  });

  test("a whitespace-only branch never leaves the branch slot visibly blank", () => {
    const html = renderToString(
      <GitChip status={{ branch: "   ", behind: 0, uncommitted: 0, unpushed: 0 }} />,
    );
    expect(html).toContain(GIT_DETACHED_LABEL);
  });

  test("an unreported tree renders the branch and NO flags — never a green clean row", () => {
    const html = renderToString(<GitChip status={{ branch: "main" } as unknown as GitStatus} />);
    expect(html).toContain("main");
    expect(html).not.toContain(GIT_CLEAN_LABEL);
    expect(html).not.toContain(GIT_CHIP_PARTS.flag);
  });
});

describe("GitChip — unavailable arm (the honesty this atom exists for)", () => {
  test("no status ⇒ the neutral note and the unavailable modifier, never a clean row", () => {
    const html = renderToString(<GitChip />);
    expect(html).toContain(`class="${gitChipClass({ unavailable: true })} "`);
    expect(html).toContain(GIT_UNAVAILABLE_NOTE);
    expect(html).toContain(GIT_BRANCH_UNKNOWN);
    expect(html).not.toContain(GIT_CLEAN_LABEL);
    expect(html).not.toContain(GIT_CHIP_PARTS.flag);
  });

  test("a product-supplied reason wins over the defaults and is also the branch-slot title", () => {
    const reason = "The working directory is not a git repository.";
    const html = renderToString(<GitChip unavailableNote={reason} />);
    expect(html).toContain(reason);
    expect(html).not.toContain(GIT_UNAVAILABLE_NOTE);
    expect(html).toContain(`title="${reason}"`);
  });

  test("a NULL status takes the unavailable arm — it must not be read as a status object", () => {
    const html = renderToString(<GitChip status={null} />);
    expect(html).toContain(`class="${gitChipClass({ unavailable: true })} "`);
    expect(html).toContain(GIT_UNAVAILABLE_NOTE);
    expect(html).not.toContain(GIT_CLEAN_LABEL);
  });

  test("a null status still honours a product-supplied reason", () => {
    const html = renderToString(<GitChip status={null} unavailableNote="Not a repository." />);
    expect(html).toContain("Not a repository.");
  });

  test("loading, with no reason, is the in-flight line", () => {
    const html = renderToString(<GitChip loading />);
    expect(html).toContain(GIT_LOADING_NOTE);
  });

  test("a reason outranks loading", () => {
    const html = renderToString(<GitChip loading unavailableNote="No worktree recorded." />);
    expect(html).toContain("No worktree recorded.");
    expect(html).not.toContain(GIT_LOADING_NOTE);
  });
});

describe("GitChip — stale is flagged on BOTH arms", () => {
  test("available + stale", () => {
    const html = renderToString(
      <GitChip status={{ branch: "main", behind: 0, uncommitted: 0, unpushed: 0 }} stale />,
    );
    expect(html).toContain(`class="${gitChipClass({ stale: true })} "`);
    expect(html).toContain(GIT_STALE_LABEL);
  });

  test("unavailable + stale", () => {
    const html = renderToString(<GitChip unavailableNote="Read failed." stale />);
    expect(html).toContain(`class="${gitChipClass({ unavailable: true, stale: true })} "`);
    expect(html).toContain(GIT_STALE_LABEL);
  });

  test("not stale ⇒ no stale marker", () => {
    const html = renderToString(
      <GitChip status={{ branch: "main", behind: 0, uncommitted: 0, unpushed: 0 }} />,
    );
    expect(html).not.toContain(GIT_CHIP_PARTS.stale);
  });
});
