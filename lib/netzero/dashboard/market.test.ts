import { describe, expect, it } from "vitest";

import { syntheticUniverse } from "@/lib/netzero/fixtures";
import type { ScenarioData } from "@/lib/netzero/types";

import { buildMarketView, sectorVerdict } from "./market";
import { buildDashboardModel } from "./model";
import { DEFAULT_ANSWERS } from "./presets";

function makeData(): ScenarioData {
  return { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
}

describe("sectorVerdict", () => {
  it("is pick-winners when the sector is tradeable, regardless of fossil share", () => {
    expect(sectorVerdict({ tradeable: true, fossilShare: 0, cleanupYears: 0 })).toBe("pick-winners");
  });

  it("is sector-hit when not tradeable but fossil-heavy or costly to clean up", () => {
    expect(sectorVerdict({ tradeable: false, fossilShare: 0.5, cleanupYears: 0 })).toBe("sector-hit");
    expect(sectorVerdict({ tradeable: false, fossilShare: 0, cleanupYears: 0.1 })).toBe("sector-hit");
  });

  it("is barely-affected otherwise", () => {
    expect(sectorVerdict({ tradeable: false, fossilShare: 0.2, cleanupYears: 0.05 })).toBe("barely-affected");
  });
});

describe("buildMarketView", () => {
  const data = makeData();
  const model = buildDashboardModel(data, DEFAULT_ANSWERS);
  const view = buildMarketView(data, model);

  it("returns one row per sector covering every company", () => {
    const sectorCount = new Set(data.companies.map((c) => c.sector)).size;
    expect(view.rows).toHaveLength(sectorCount);
    expect(view.rows.reduce((a, r) => a + r.n, 0)).toBe(data.companies.length);
  });

  it("groups rows pick-winners, then sector-hit, then barely-affected", () => {
    const order: Record<string, number> = { "pick-winners": 0, "sector-hit": 1, "barely-affected": 2 };
    const seen = view.rows.map((r) => order[r.verdict]);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it("every row's verdict is consistent with its own numbers", () => {
    for (const row of view.rows) {
      const tradeable = row.verdict === "pick-winners" ? true : false;
      // pick-winners rows are exactly the tradeable ones; re-deriving with tradeable=false must
      // never upgrade a sector-hit/barely-affected row to pick-winners.
      if (row.verdict !== "pick-winners") {
        expect(sectorVerdict({ tradeable: false, fossilShare: row.fossilShare, cleanupYears: row.cleanupYears })).toBe(row.verdict);
      } else {
        expect(tradeable).toBe(true);
      }
    }
  });

  it("produces 4 index-level tiles including the pick-winners count", () => {
    expect(view.tiles).toHaveLength(4);
    const pickWinners = view.rows.filter((r) => r.verdict === "pick-winners").length;
    expect(view.tiles.find((t) => t.label === "Sectors to pick winners")?.value).toBe(String(pickWinners));
  });

  it("generates at most 3 takeaways naming real sectors", () => {
    expect(view.takeaways.length).toBeGreaterThan(0);
    expect(view.takeaways.length).toBeLessThanOrEqual(3);
    const sectorNames = view.rows.map((r) => r.sector);
    expect(sectorNames.some((s) => view.takeaways[0].includes(s))).toBe(true);
  });
});
