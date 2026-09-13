import { describe, expect, it } from "vitest";
import { defaultConfig, macVector } from "./config";
import { runEngine } from "./engine";
import { MID_MAC, PDF_EXAMPLE_CONFIG, PDF_UTILITIES, syntheticUniverse } from "./fixtures";
import { ratios, runScenario } from "./scenario";
import type { CompanyInput, MacRow } from "./types";

function baseCompany(overrides: Partial<CompanyInput>): CompanyInput {
  return {
    ticker: "X",
    companyName: "X",
    sector: "Sector",
    subIndustry: "Sub",
    emissions: { scope2: null, combustion: null, fleet: null, process: null, fugitive: null },
    revenueTtm: 100,
    ebitdaTtm: 10,
    fcfTtm: 5,
    netDebt: 20,
    de: 0.1,
    ben: 0.1,
    deBenStatus: "tagged",
    price: null,
    sharesOutstanding: null,
    floatCap: null,
    flags: [],
    ...overrides,
  };
}

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

  it("flags ENE0's leverage per its net debt sign under negative EBITDA, and keeps ndEbitda null", () => {
    const universe = syntheticUniverse();
    const ene0 = universe.find((c) => c.ticker === "ENE0")!;
    expect(ene0.ebitdaTtm).not.toBeNull();
    expect(ene0.ebitdaTtm!).toBeLessThanOrEqual(0);
    const expectedFlag = ene0.netDebt !== null && ene0.netDebt > 0 ? "leverage-negative-ebitda" : "leverage-imputed";
    expect(scores.get("ENE0")!.flags).toContain(expectedFlag);
    expect(scores.get("ENE0")!.ndEbitda).toBeNull();
  });

  it("runEngine v1 returns the same scores", () => {
    expect(runEngine(syntheticUniverse(), config).scores.get("UTI3")!.score).toBeCloseTo(scores.get("UTI3")!.score, 12);
  });
});

describe("ratios (negative EBITDA leverage ruling)", () => {
  it("flags negativeEbitdaWithDebt when EBITDA <= 0 and net debt > 0", () => {
    const c = baseCompany({ ebitdaTtm: -5, netDebt: 20 });
    const r = ratios(c);
    expect(r.ndEbitda).toBeNull();
    expect(r.negativeEbitdaWithDebt).toBe(true);
  });

  it("does not flag negativeEbitdaWithDebt when EBITDA <= 0 and net debt <= 0 (net cash)", () => {
    const c = baseCompany({ ebitdaTtm: -5, netDebt: -20 });
    const r = ratios(c);
    expect(r.ndEbitda).toBeNull();
    expect(r.negativeEbitdaWithDebt).toBeFalsy();
  });

  it("does not flag negativeEbitdaWithDebt when EBITDA or net debt is null", () => {
    expect(ratios(baseCompany({ ebitdaTtm: null, netDebt: 20 })).negativeEbitdaWithDebt).toBeFalsy();
    expect(ratios(baseCompany({ ebitdaTtm: -5, netDebt: null })).negativeEbitdaWithDebt).toBeFalsy();
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
