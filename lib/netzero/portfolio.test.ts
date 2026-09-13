import { describe, expect, it } from "vitest";
import { MID_MAC, syntheticUniverse } from "./fixtures";
import { buildPortfolioView, coverageCounts, DEFAULT_CONTROLS, stressKey, TOP_N } from "./portfolio";
import { CATEGORIES, type MacRow, type ScenarioData } from "./types";
import { defaultConfig } from "./config";
import { runEngine } from "./engine";

const EPS = 1e-9;
const macRows: MacRow[] = CATEGORIES.map((category) => ({
  category,
  low: MID_MAC[category] * 0.5,
  mid: MID_MAC[category],
  high: MID_MAC[category] * 1.5,
  source: "test",
  sourceDate: "2026-09-13",
}));
const data: ScenarioData = { companies: syntheticUniverse(), macRows, productMap: [], segments: [], validation: [], error: null };

describe("buildPortfolioView — long-only default (PDF §9.2, §10)", () => {
  const view = buildPortfolioView(data, DEFAULT_CONTROLS);

  it("uses the mid cost point, USD 1bn and the long-only mandate", () => {
    expect(view.config.mac).toEqual(MID_MAC);
    expect(view.macMissing).toEqual([]);
    expect(view.config.mandate).toBe("long-only");
    expect(view.config.capital).toBe(1e9);
  });

  it("lists the full weight vector and invests all capital", () => {
    expect(view.rows).toHaveLength(view.longOnly.weights.size);
    expect(view.rows.reduce((a, r) => a + r.dollars, 0)).toBeCloseTo(1e9, 0);
    expect(view.summary.gross).toBeCloseTo(1, 9);
    expect(view.summary.cash).toBeCloseTo(0, 9);
    expect(view.summary.activeShare).toBeGreaterThan(0);
    expect(view.summary.activeShare).toBeLessThanOrEqual(1);
  });

  it("holds sector weights at benchmark while the exclusion book moves them", () => {
    let benchmark = 0;
    let exclusion = 0;
    for (const row of view.sectorTable) {
      expect(row.tilt).toBeCloseTo(row.benchmark, 9);
      benchmark += row.benchmark;
      exclusion += row.exclusion;
    }
    expect(benchmark).toBeCloseTo(1, 9);
    expect(exclusion).toBeCloseTo(1, 9);
    expect(view.sectorTable.some((r) => Math.abs(r.exclusion - r.benchmark) > 1e-6)).toBe(true);
  });

  it("ranks the largest over- and underweights", () => {
    expect(view.topOverweights.length).toBeGreaterThan(0);
    expect(view.topOverweights.length).toBeLessThanOrEqual(TOP_N);
    const over = view.topOverweights.map((r) => r.activeWeight!);
    expect(over).toEqual([...over].sort((a, b) => b - a));
    expect(over.every((a) => a > 0)).toBe(true);
    const under = view.topUnderweights.map((r) => r.activeWeight!);
    expect(under).toEqual([...under].sort((a, b) => a - b));
    expect(under.every((a) => a < 0)).toBe(true);
  });
});

describe("buildPortfolioView — long/short (PDF §9.1)", () => {
  const view = buildPortfolioView(data, { ...DEFAULT_CONTROLS, mandate: "long-short", capital: 5e8 });

  it("uses the long/short positions as rows and stays dollar-neutral", () => {
    expect(view.rows).toHaveLength(view.longShort.positions.length);
    expect(Math.abs(view.rows.reduce((a, r) => a + r.dollars, 0))).toBeLessThan(1e-3);
    expect(Math.abs(view.summary.net)).toBeLessThan(EPS);
    expect(view.summary.names).toBe(view.longShort.positions.length);
    expect(view.sectorTable.reduce((a, r) => a + r.longShortGross, 0)).toBeCloseTo(view.summary.gross, 9);
  });

  it("orders the largest longs and shorts by size with signed weights", () => {
    const longs = view.largestLongs.map((r) => r.weight);
    const shorts = view.largestShorts.map((r) => r.weight);
    expect(longs.every((w) => w > 0)).toBe(true);
    expect(shorts.every((w) => w < 0)).toBe(true);
    expect(longs).toEqual([...longs].sort((a, b) => b - a));
    expect(shorts).toEqual([...shorts].sort((a, b) => a - b));
  });
});

describe("controls", () => {
  it("passes the cost point and thresholds into the config", () => {
    const view = buildPortfolioView(data, { ...DEFAULT_CONTROLS, macPoint: "high", tbrIqrThreshold: 1e9, scoreIqrThreshold: 1e9 });
    expect(view.config.mac.fleet).toBe(300);
    expect(view.result.dispersion.every((d) => !d.tradeable)).toBe(true);
    expect(view.summary.activeShare).toBe(0);
  });

  it("reports missing cost categories", () => {
    expect(buildPortfolioView({ ...data, macRows: [] }, DEFAULT_CONTROLS).macMissing).toEqual([...CATEGORIES]);
  });

  it("builds a stress key that ignores capital but tracks mandate and costs", () => {
    const a = buildPortfolioView(data, DEFAULT_CONTROLS).config;
    const b = buildPortfolioView(data, { ...DEFAULT_CONTROLS, capital: 2e9 }).config;
    const c = buildPortfolioView(data, { ...DEFAULT_CONTROLS, mandate: "long-short" }).config;
    const d = buildPortfolioView(data, { ...DEFAULT_CONTROLS, macPoint: "low" }).config;
    expect(stressKey(a)).toBe(stressKey(b));
    expect(stressKey(a)).not.toBe(stressKey(c));
    expect(stressKey(a)).not.toBe(stressKey(d));
  });
});

describe("halving flipped positions (PDF §11)", () => {
  it("cuts a flipped long/short position and keeps the book neutral", () => {
    const controls = { ...DEFAULT_CONTROLS, mandate: "long-short" as const };
    const base = buildPortfolioView(data, controls);
    const target = base.largestLongs[0].ticker;
    const halved = buildPortfolioView(data, controls, new Set([target]));
    const before = base.longShort.positions.find((p) => p.ticker === target)!.weight;
    const after = halved.longShort.positions.find((p) => p.ticker === target)!.weight;
    expect(after).toBeLessThan(before);
    expect(Math.abs(halved.summary.net)).toBeLessThan(EPS);
    expect(halved.halved).toEqual([target]);
  });

  it("keeps long-only sector weights at benchmark after halving", () => {
    const base = buildPortfolioView(data, DEFAULT_CONTROLS);
    const target = base.topOverweights[0].ticker;
    const halved = buildPortfolioView(data, DEFAULT_CONTROLS, new Set([target]));
    expect(halved.longOnly.weights.get(target)!.active).toBeCloseTo(base.longOnly.weights.get(target)!.active / 2, 12);
    for (const row of halved.sectorTable) expect(row.tilt).toBeCloseTo(row.benchmark, 9);
    expect(halved.halved).toEqual([target]);
  });
});

describe("coverageCounts", () => {
  it("counts companies with and without emissions, missing EBITDA and DE/BEN status", () => {
    const coverage = coverageCounts(data);
    expect(coverage.companies).toBe(60);
    expect(coverage.noEmissions).toBe(4);
    expect(coverage.withEmissions).toBe(56);
    expect(coverage.missingEbitda).toBe(4);
    expect(coverage.missingFloatCap).toBe(0);
    expect(coverage.deBenStatus).toEqual({ tagged: 60, note: 0, imputed: 0, unclassified: 0 });
    expect(coverage.flags).toEqual([]);
  });

  it("counts merged engine flags per company when scores are supplied", () => {
    const config = defaultConfig(MID_MAC);
    const result = runEngine(data.companies, config);
    const coverage = coverageCounts(data, result.scores);
    const flagNames = coverage.flags.map(([flag]) => flag);
    expect(flagNames).toContain("tbr-imputed-no-emissions");
  });
});
