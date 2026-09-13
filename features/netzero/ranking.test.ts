import { describe, expect, it } from "vitest";

import { companyLabel } from "@/features/netzero/engine/dashboard/labels";
import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import { verdictForTicker } from "@/features/netzero/explain/verdict";

import { buildNetZeroRanking } from "./ranking";

describe("buildNetZeroRanking", () => {
  const data = { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
  const model = buildDashboardModel(data, DEFAULT_ANSWERS);
  const rows = buildNetZeroRanking(data, model);

  it("lists every scored company exactly once", () => {
    expect(rows.map((r) => r.ticker).sort()).toEqual([...model.result.scores.keys()].sort());
  });

  it("orders rows by sector, then by rank inside the sector", () => {
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const cur = rows[i];
      const bySector = prev.sector.localeCompare(cur.sector);
      expect(bySector < 0 || (bySector === 0 && prev.rank <= cur.rank)).toBe(true);
    }
  });

  it("carries the engine score, company name, sector label and BUY/HOLD/SELL verdict", () => {
    for (const row of rows) {
      const score = model.result.scores.get(row.ticker)!;
      const company = data.companies.find((c) => c.ticker === row.ticker)!;
      expect(row).toMatchObject({
        companyName: company.companyName,
        sector: score.sector,
        score: score.score,
        rank: score.rank,
        sectorSize: score.sectorSize,
        label: companyLabel(score),
        verdict: verdictForTicker(model, row.ticker)!.band,
      });
    }
  });
});
