import { describe, expect, it } from "vitest";
import { runEngine } from "./engine";
import { DEFAULT_TEST_CONFIG, MID_MAC, syntheticUniverse } from "./fixtures";
import { LS_LIMITS } from "./longShort";
import type { LongOnlyBook } from "./longOnly";
import { groupBySector } from "./scenario";
import {
  DRAW_SURVIVAL_THRESHOLD,
  flippedTickers,
  halveLongOnly,
  halveLongShort,
  longOnlySigns,
  macScenarios,
  PICK_ACTIVE_THRESHOLD,
  runSensitivity,
} from "./sensitivity";

const EPS = 1e-9;
const companies = syntheticUniverse();

describe("macScenarios (PDF §11)", () => {
  it("returns base, all ±50% and each category doubled on its own", () => {
    const scenarios = macScenarios(MID_MAC);
    expect(scenarios.map((s) => s.id)).toEqual([
      "base",
      "all-0.5",
      "all-1.5",
      "scope2-x2",
      "combustion-x2",
      "fleet-x2",
      "process-x2",
      "fugitive-x2",
    ]);
    expect(scenarios[1].mac.combustion).toBe(60);
    expect(scenarios[2].mac.fleet).toBe(300);
    expect(scenarios[5].mac.fleet).toBe(400);
    expect(scenarios[5].mac.combustion).toBe(120);
  });
});

describe("runSensitivity", () => {
  const config = { ...DEFAULT_TEST_CONFIG, mandate: "long-short" as const };
  const result = runSensitivity(companies, config, { draws: 25, seed: 7 });

  it("is reproducible for a fixed seed and reports a headline in [0, 1]", () => {
    const again = runSensitivity(companies, config, { draws: 25, seed: 7 });
    expect(again.picks).toEqual(result.picks);
    expect(result.scenarios).toHaveLength(8);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.headline).toBeGreaterThanOrEqual(0);
    expect(result.headline).toBeLessThanOrEqual(1);
  });

  it("classifies survival consistently with its definitions", () => {
    for (const p of result.picks) {
      expect(p.macRuns).toBe(7);
      const expected = p.macSame === 7 ? "all" : p.macSame * 2 >= 7 ? "most" : "few";
      expect(p.macSurvival).toBe(expected);
      expect(p.robust).toBe(p.macSurvival === "all" && p.drawSurvival >= DRAW_SURVIVAL_THRESHOLD);
      expect(Math.abs(p.baseSign)).toBe(1);
    }
    const robust = result.picks.filter((p) => p.robust).length;
    expect(result.headline).toBeCloseTo(robust / result.picks.length, 12);
  });

  it("lists exactly the picks that flip under ±50% costs", () => {
    expect([...flippedTickers(result)].sort()).toEqual(
      result.picks.filter((p) => p.flippedUnder50).map((p) => p.ticker).sort(),
    );
  });

  it("covers the long-only mandate too", () => {
    const lo = runSensitivity(companies, DEFAULT_TEST_CONFIG, { draws: 10, seed: 3 });
    expect(lo.picks.length).toBeGreaterThan(0);
    expect(lo.draws).toBe(10);
    expect(lo.seed).toBe(3);
  });
});

describe("longOnlySigns pick threshold (finding 3)", () => {
  it("excludes a ticker whose active weight is below the 1bp threshold", () => {
    const book = {
      weights: new Map([
        ["BELOW", { ticker: "BELOW", sector: "S", benchmark: 0.1, portfolio: 0.10005, active: 0.00005 }],
        ["AT", { ticker: "AT", sector: "S", benchmark: 0.1, portfolio: 0.1001, active: PICK_ACTIVE_THRESHOLD }],
        ["ABOVE", { ticker: "ABOVE", sector: "S", benchmark: 0.1, portfolio: 0.099, active: -0.001 }],
      ]),
      sectorWeights: new Map(),
      events: [],
    } as unknown as LongOnlyBook;
    const signs = longOnlySigns(book);
    expect(signs.has("BELOW")).toBe(false);
    expect(signs.get("AT")).toBe(1);
    expect(signs.get("ABOVE")).toBe(-1);
  });
});

describe("halving flipped positions", () => {
  const result = runEngine(companies, DEFAULT_TEST_CONFIG);

  it("keeps the long/short book dollar-neutral in every sector", () => {
    const flipped = new Set(result.longShort.positions.slice(0, 3).map((p) => p.ticker));
    const book = halveLongShort(result.longShort, flipped);
    expect(Math.abs(book.net)).toBeLessThan(EPS);
    expect(book.gross).toBeLessThan(result.longShort.gross + EPS);
    for (const [, members] of groupBySector(book.positions)) {
      const long = members.filter((p) => p.side === "long").reduce((a, p) => a + p.weight, 0);
      const short = members.filter((p) => p.side === "short").reduce((a, p) => a + p.weight, 0);
      expect(long).toBeCloseTo(short, 9);
    }
  });

  it("keeps long-only sector weights at benchmark and halves the flipped active weights", () => {
    const tilted = [...result.longOnly.weights.values()].filter((w) => Math.abs(w.active) > EPS).slice(0, 4);
    const book = halveLongOnly(result.longOnly, new Set(tilted.map((w) => w.ticker)));
    for (const { benchmark, portfolio } of book.sectorWeights.values()) expect(portfolio).toBeCloseTo(benchmark, 9);
    for (const w of tilted) expect(book.weights.get(w.ticker)!.active).toBeCloseTo(w.active / 2, 12);
  });
});
