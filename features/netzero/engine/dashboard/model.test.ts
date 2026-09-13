import { describe, expect, it } from "vitest";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { buildDashboardModel } from "./model";
import { DEFAULT_ANSWERS } from "./presets";
import type { RiskAnswers } from "./types";

function scenarioData(): ScenarioData {
  return { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
}

const data = scenarioData();

function answers(overrides: Partial<RiskAnswers>): RiskAnswers {
  return { ...DEFAULT_ANSWERS, ...overrides };
}

describe("buildDashboardModel", () => {
  it("never lets the Conservative (±1pp) preset's active weight exceed 0.01", () => {
    const model = buildDashboardModel(data, answers({ trail: "low" }));
    expect(model.preset.activeLimit).toBe(0.01);
    for (const w of model.result.longOnly.weights.values()) {
      expect(Math.abs(w.active)).toBeLessThanOrEqual(0.01 + 1e-9);
    }
  });

  it("runs the stress test for the preset's book with 300 draws, seed 42", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    expect(model.stress).not.toBeNull();
    expect(model.stress!.draws).toBe(300);
    expect(model.stress!.seed).toBe(42);
  });

  it("holds non-robust names at benchmark and keeps every sector at its benchmark weight when robustOnly is set", () => {
    const model = buildDashboardModel(data, answers({ robustOnly: true }));
    const nonRobust = new Set(model.stress!.picks.filter((p) => !p.robust).map((p) => p.ticker));
    expect(nonRobust.size).toBeGreaterThan(0);
    for (const ticker of nonRobust) {
      const w = model.result.longOnly.weights.get(ticker);
      if (w) expect(w.active).toBe(0);
    }
    for (const [, sw] of model.result.longOnly.sectorWeights) {
      expect(sw.portfolio).toBeCloseTo(sw.benchmark, 9);
    }
  });

  it("trades at least as many sectors Aggressive as Balanced on the synthetic universe", () => {
    const balanced = buildDashboardModel(data, DEFAULT_ANSWERS);
    const aggressive = buildDashboardModel(data, answers({ trail: "high" }));
    const tradedSectors = (weights: typeof balanced.result.longOnly.weights) =>
      new Set([...weights.values()].filter((w) => Math.abs(w.active) > 1e-9).map((w) => w.sector)).size;
    expect(tradedSectors(aggressive.result.longOnly.weights)).toBeGreaterThanOrEqual(tradedSectors(balanced.result.longOnly.weights));
  });

  it("builds the model for the synthetic universe (60 companies) well under the 200ms budget for 503", () => {
    const start = performance.now();
    buildDashboardModel(data, DEFAULT_ANSWERS);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
