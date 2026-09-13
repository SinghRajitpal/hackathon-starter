import { describe, expect, it } from "vitest";

import { syntheticUniverse } from "@/lib/netzero/fixtures";
import type { ScenarioData } from "@/lib/netzero/types";

import { buildDashboardModel } from "./model";
import { DEFAULT_ANSWERS } from "./presets";
import { buildSectorView } from "./sector";

function makeData(): ScenarioData {
  return { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
}

describe("buildSectorView", () => {
  const data = makeData();
  const model = buildDashboardModel(data, DEFAULT_ANSWERS);

  it("returns null for an unknown sector", () => {
    expect(buildSectorView(data, model, "Not A Sector")).toBeNull();
  });

  it("lists every company in the sector, ranked best score first", () => {
    const view = buildSectorView(data, model, "Utilities")!;
    expect(view).not.toBeNull();
    const expectedTickers = new Set(data.companies.filter((c) => c.sector === "Utilities").map((c) => c.ticker));
    expect(new Set(view.rows.map((r) => r.ticker))).toEqual(expectedTickers);
    for (let i = 1; i < view.rows.length; i++) expect(view.rows[i].score).toBeLessThanOrEqual(view.rows[i - 1].score);
  });

  it("produces 4 tiles and at most 3 takeaways", () => {
    const view = buildSectorView(data, model, "Energy")!;
    expect(view.tiles).toHaveLength(4);
    expect(view.takeaways.length).toBeGreaterThan(0);
    expect(view.takeaways.length).toBeLessThanOrEqual(3);
  });

  it("labels each row leader/middle/laggard by rank quintile within the sector", () => {
    const view = buildSectorView(data, model, "Industrials")!;
    const n = view.rows.length;
    const q = Math.max(1, Math.ceil(n / 5));
    for (const row of view.rows) {
      const rank = view.rows.filter((r) => r.score > row.score).length + 1;
      if (rank <= q) expect(row.label).toBe("leader");
      else if (rank > n - q) expect(row.label).toBe("laggard");
    }
  });
});
