import { describe, expect, it } from "vitest";

import { syntheticUniverse } from "@/lib/netzero/fixtures";
import type { ScenarioData } from "@/lib/netzero/types";

import { buildDashboardModel } from "./model";
import { DEFAULT_ANSWERS } from "./presets";
import { buildPortfolioDashboard, portfolioMetrics } from "./portfolio";

function makeData(): ScenarioData {
  return { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
}

describe("portfolioMetrics", () => {
  it("puts all weight on one company to isolate its own metrics", () => {
    const data = makeData();
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const ticker = data.companies[0].ticker;
    const score = model.result.scores.get(ticker)!;
    const company = data.companies[0];
    const weights = new Map([[ticker, 1]]);

    const m = portfolioMetrics(data, model, weights);

    expect(m.cleanupYears).toBeCloseTo(score.tbr, 6);
    expect(m.fossilShare).toBeCloseTo(score.de ?? 0, 6);
    expect(m.greenShare).toBeCloseTo(score.ben ?? 0, 6);
    if (score.bill !== null && company.floatCap !== null && company.floatCap > 0) {
      expect(m.carbonCostPerMillion).toBeCloseTo((score.bill / company.floatCap) * 1e6, 4);
    }
  });

  it("returns zero metrics for an empty weight map", () => {
    const data = makeData();
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const m = portfolioMetrics(data, model, new Map());
    expect(m).toEqual({ cleanupYears: 0, carbonCostPerMillion: 0, fossilShare: 0, greenShare: 0 });
  });
});

describe("buildPortfolioDashboard", () => {
  const data = makeData();

  it("produces tiles, a 5-row comparison table with a zero-active-share benchmark column, and <=3 takeaways", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const view = buildPortfolioDashboard(data, model);

    expect(view.tiles.length).toBeGreaterThanOrEqual(3);
    expect(view.tiles.length).toBeLessThanOrEqual(5);
    expect(view.comparison).toHaveLength(5);
    const activeShareRow = view.comparison.find((r) => r.metric.toLowerCase().includes("active share"));
    expect(activeShareRow).toBeDefined();
    expect(activeShareRow!.benchmark).toBeCloseTo(0, 9);
    expect(view.takeaways.length).toBeLessThanOrEqual(3);
  });

  it("caps overweights and underweights at 10, with correct signs", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const view = buildPortfolioDashboard(data, model);

    expect(view.overweights.length).toBeLessThanOrEqual(10);
    expect(view.underweights.length).toBeLessThanOrEqual(10);
    for (const row of view.overweights) expect(row.activePp).toBeGreaterThan(0);
    for (const row of view.underweights) expect(row.activePp).toBeLessThan(0);
  });

  it("produces a CSV whose header matches the allocation columns", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const view = buildPortfolioDashboard(data, model);
    const [header] = view.csv.split("\n");
    expect(header).toContain("ticker");
    expect(header).toContain("weight");
  });

  it("omits the long/short book unless the preset allows shorts", () => {
    const balanced = buildDashboardModel(data, DEFAULT_ANSWERS);
    expect(buildPortfolioDashboard(data, balanced).longShort).toBeNull();

    const aggressive = buildDashboardModel(data, { trail: "high", allowShorts: true, robustOnly: false });
    const view = buildPortfolioDashboard(data, aggressive);
    expect(view.longShort).not.toBeNull();
    expect(view.longShort!.length).toBeGreaterThan(0);
  });

  it("reports robustness from the stress test when present, and a neutral fallback when null", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const withoutStress = buildPortfolioDashboard(data, model);
    expect(withoutStress.robustnessText.length).toBeGreaterThan(0);

    const stressed = {
      ...model,
      stress: { scenarios: [], picks: [], headline: 0.75, draws: 300, seed: 42 },
    };
    const withStress = buildPortfolioDashboard(data, stressed);
    expect(withStress.robustnessText).toContain("75%");
  });
});
