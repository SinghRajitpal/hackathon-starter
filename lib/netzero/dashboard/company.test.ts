import { describe, expect, it } from "vitest";

import { buildDashboardModel } from "@/lib/netzero/dashboard/model";
import { DEFAULT_ANSWERS } from "@/lib/netzero/dashboard/presets";
import { syntheticUniverse } from "@/lib/netzero/fixtures";
import { median } from "@/lib/netzero/stats";
import { CATEGORIES } from "@/lib/netzero/types";

import { buildCompanyView } from "./company";

describe("buildCompanyView", () => {
  const data = { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
  const model = buildDashboardModel(data, DEFAULT_ANSWERS);

  it("returns null for a ticker not in the universe", () => {
    expect(buildCompanyView(data, model, "NOPE")).toBeNull();
  });

  it("builds a header matching the engine score and sector quintile", () => {
    const ticker = "UTI3";
    const score = model.result.scores.get(ticker)!;
    const view = buildCompanyView(data, model, ticker)!;
    expect(view).not.toBeNull();
    expect(view.header).toMatchObject({
      ticker,
      sector: "Utilities",
      score: score.score,
      rank: score.rank,
      sectorSize: score.sectorSize,
    });
    expect(view.header.verdictText).toContain(view.header.sector);
    expect(view.header.verdictText.startsWith("Leader") || view.header.verdictText.startsWith("Middle") || view.header.verdictText.startsWith("Laggard")).toBe(true);
  });

  it("produces exactly 4 tiles compared to the sector median", () => {
    const ticker = "UTI3";
    const score = model.result.scores.get(ticker)!;
    const sectorScores = [...model.result.scores.values()].filter((s) => s.sector === score.sector);
    const medianTbr = median(sectorScores.map((s) => s.tbr));
    const view = buildCompanyView(data, model, ticker)!;
    expect(view.tiles).toHaveLength(4);
    expect(view.tiles[0].label).toBe("Cleanup cost");
    expect(view.tiles[0].sub).toContain(medianTbr.toFixed(2));
  });

  it("splits the cleanup bill across the five emissions categories using the configured MAC", () => {
    const ticker = "UTI0";
    const company = data.companies.find((c) => c.ticker === ticker)!;
    const view = buildCompanyView(data, model, ticker)!;
    expect(view.billSplit).toHaveLength(5);
    for (const row of view.billSplit) {
      expect(CATEGORIES).toContain(row.category);
      const e = company.emissions[row.category];
      const expected = e === null ? null : e * model.config.mac[row.category];
      expect(row.usd).toBe(expected);
    }
  });

  it("ranks sector peers by score and flags the selected company", () => {
    const ticker = "UTI3";
    const score = model.result.scores.get(ticker)!;
    const view = buildCompanyView(data, model, ticker)!;
    expect(view.peers).toHaveLength(score.sectorSize);
    const self = view.peers.find((p) => p.isSelf);
    expect(self?.ticker).toBe(ticker);
    for (let i = 1; i < view.peers.length; i++) expect(view.peers[i - 1].score).toBeGreaterThanOrEqual(view.peers[i].score);
  });

  it("marks data as estimated when the score carries an imputed flag", () => {
    const ticker = "UTI1"; // synthetic fixture: missing emissions -> tbr-imputed-no-emissions
    const score = model.result.scores.get(ticker)!;
    expect(score.flags.some((f) => f.includes("imputed"))).toBe(true);
    const view = buildCompanyView(data, model, ticker)!;
    expect(view.badges.data).toBe("estimated");
  });

  it("reports 'no-position' robustness when the model has not run a stress test", () => {
    const view = buildCompanyView(data, { ...model, stress: null }, "UTI3")!;
    expect(view.badges.robust).toBe("no-position");
  });

  it("derives fund stance from the long-only active weight", () => {
    const ticker = "UTI3";
    const active = model.result.longOnly.weights.get(ticker)?.active ?? 0;
    const view = buildCompanyView(data, model, ticker)!;
    if (Math.abs(active) < 1e-4) expect(view.stance).toBe("Held at benchmark");
    else if (active > 0) expect(view.stance).toMatch(/^Overweight \+/);
    else expect(view.stance).toMatch(/^Underweight/);
  });

  it("includes the reason sentence and at most 3 takeaways", () => {
    const view = buildCompanyView(data, model, "UTI3")!;
    expect(view.reason.length).toBeGreaterThan(0);
    expect(view.takeaways.length).toBeLessThanOrEqual(3);
  });
});
