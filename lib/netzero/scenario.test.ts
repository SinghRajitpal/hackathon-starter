import { describe, expect, it } from "vitest";
import { defaultConfig, macVector } from "./config";
import { runEngine } from "./engine";
import { MID_MAC, PDF_EXAMPLE_CONFIG, PDF_UTILITIES, syntheticUniverse } from "./fixtures";
import { runScenario } from "./scenario";
import type { MacRow } from "./types";

describe("PDF §12 worked example", () => {
  it("derives entropy weights 0.29 / 0.42 / 0.29", () => {
    const { sectors } = runScenario(PDF_UTILITIES, PDF_EXAMPLE_CONFIG);
    const [tbr, de, leverage] = sectors[0].weights;
    expect(Math.abs(tbr - 0.29)).toBeLessThan(0.01);
    expect(Math.abs(de - 0.42)).toBeLessThan(0.01);
    expect(Math.abs(leverage - 0.29)).toBeLessThan(0.01);
  });

  it("scores U4 80.8, U2 72.4, U3 44.0, U1 20.2, U5 0.0 and ranks U4 first", () => {
    const { scores } = runScenario(PDF_UTILITIES, PDF_EXAMPLE_CONFIG);
    const expected: Record<string, number> = { U4: 80.8, U2: 72.4, U3: 44.0, U1: 20.2, U5: 0.0 };
    for (const [ticker, score] of Object.entries(expected)) {
      expect(Math.abs(scores.get(ticker)!.score - score)).toBeLessThan(0.3);
    }
    expect(scores.get("U4")!.rank).toBe(1);
    expect(scores.get("U5")!.rank).toBe(5);
    expect(scores.get("U4")!.topPercent).toBe(20);
  });
});

describe("runScenario on the synthetic universe", () => {
  const config = defaultConfig(MID_MAC);
  const { scores, sectors } = runScenario(syntheticUniverse(), config);

  it("ranks every sector from 1 with topPercent up to 100", () => {
    const energy = [...scores.values()].filter((s) => s.sector === "Energy");
    expect(energy.map((s) => s.rank).sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(Math.max(...energy.map((s) => s.topPercent))).toBe(100);
  });

  it("keeps sector weights summing to 1 and at or below the 0.40 cap, and scores in [0, 100]", () => {
    for (const s of sectors) {
      expect(s.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      for (const w of s.weights) expect(w).toBeLessThanOrEqual(0.4 + 1e-9);
    }
    for (const s of scores.values()) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("carries TBR fallback flags onto the company score", () => {
    expect(scores.get("ENE1")!.flags).toContain("tbr-imputed-no-emissions");
    expect(scores.get("ENE0")!.flags).toContain("ebitda-near-zero");
  });

  it("runEngine v1 returns the same scores", () => {
    expect(runEngine(syntheticUniverse(), config).scores.get("UTI3")!.score).toBeCloseTo(scores.get("UTI3")!.score, 12);
  });
});

describe("macVector", () => {
  it("picks the requested point and falls back to PDF mid-points for missing categories", () => {
    const rows: MacRow[] = [{ category: "fleet", low: 100, mid: 200, high: 300, source: "x", sourceDate: "2026-09-13" }];
    const { mac, missing } = macVector(rows, "high");
    expect(mac.fleet).toBe(300);
    expect(mac.combustion).toBe(120);
    expect(missing).toEqual(["scope2", "combustion", "process", "fugitive"]);
  });
});
