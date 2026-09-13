import { describe, expect, it } from "vitest";
import type { SectorDispersion } from "./dispersion";
import { sectorDispersion } from "./dispersion";
import { DEFAULT_TEST_CONFIG, syntheticUniverse } from "./fixtures";
import { buildLongOnly, LO_LIMITS, tiltSector } from "./longOnly";
import { runScenario, type CompanyScore } from "./scenario";

const EPS = 1e-9;

describe("tiltSector (spec D15)", () => {
  it("zeroes the bottom decile, cuts the rest of the bottom quintile by distance and feeds the top quintile", () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ ticker: `T${i}`, score: i * 10, benchmark: 0.01 }));
    const { weights } = tiltSector(members);
    expect(weights.get("T0")).toBeCloseTo(0, 12);
    expect(weights.get("T1")).toBeCloseTo(0.01 - 0.01 * (35 / 45), 12);
    expect(weights.get("T8")).toBeCloseTo(0.01 + (0.01 + 0.01 * (35 / 45)) * (35 / 80), 12);
    expect(weights.get("T9")).toBeCloseTo(0.01 + (0.01 + 0.01 * (35 / 45)) * (45 / 80), 12);
    for (let i = 2; i <= 7; i++) expect(weights.get(`T${i}`)).toBeCloseTo(0.01, 12);
    expect([...weights.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(0.1, 12);
  });

  it("limits a cut to 2pp active and never lets a name exceed 5%", () => {
    const members = [
      { ticker: "BIG", score: 0, benchmark: 0.04 },
      { ticker: "M1", score: 50, benchmark: 0.01 },
      { ticker: "M2", score: 60, benchmark: 0.01 },
      { ticker: "M3", score: 70, benchmark: 0.01 },
      { ticker: "TOP", score: 100, benchmark: 0.045 },
    ];
    const { weights, events } = tiltSector(members);
    expect(weights.get("BIG")).toBeCloseTo(0.02, 12);
    expect(weights.get("TOP")).toBeLessThanOrEqual(0.05 + 1e-12);
    expect([...weights.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(0.115, 12);
    expect(events.some((e) => e.includes("BIG"))).toBe(true);
  });
});

describe("tiltSector ties", () => {
  it("sorts ties by ticker so shuffled input order gives identical weights", () => {
    const members = Array.from({ length: 10 }, (_, i) => ({ ticker: `T${i}`, score: 5, benchmark: 0.01 }));
    const shuffled = [...members].reverse();
    const forward = tiltSector(members).weights;
    const backward = tiltSector(shuffled).weights;
    expect(Object.fromEntries(backward)).toEqual(Object.fromEntries(forward));
  });
});

describe("buildLongOnly skips zero-dispersion sectors", () => {
  it("leaves every name at benchmark when the sector's scores are all tied", () => {
    // 25 equal-benchmark (4%) names: below the 5% name cap, so a real tilt would move weight
    // (unlike a skewed benchmark where the cap neutralises everything) — a faithful RED case.
    const n = 25;
    const companies = Array.from({ length: n }, (_, i) => ({
      ticker: `T${i}`,
      companyName: `T${i}`,
      sector: "Tied",
      subIndustry: "Tied",
      emissions: { scope2: 0, combustion: 0, fleet: 0, process: 0, fugitive: 0 },
      revenueTtm: 1e9,
      ebitdaTtm: 1e8,
      fcfTtm: 1e7,
      netDebt: 1e7,
      de: 0.1,
      ben: 0,
      deBenStatus: "tagged" as const,
      price: 20,
      sharesOutstanding: 1e8,
      floatCap: 1e9,
      flags: [],
    }));
    // Tied scores (scoreIqr = 0) but distinct tbr so tbrIqr alone makes the sector tradeable.
    const scores = new Map(
      companies.map((c, i) => [
        c.ticker,
        {
          ticker: c.ticker,
          sector: "Tied",
          score: 5,
          dPlus: 0,
          rank: i + 1,
          sectorSize: n,
          topPercent: 100,
          bill: null,
          tbr: i,
          de: 0.1,
          ben: 0,
          ndEbitda: 1,
          fcfMargin: 0.1,
          x: {},
          shares: {},
          flags: [],
        } as unknown as CompanyScore,
      ]),
    );
    const dispersion: SectorDispersion[] = [
      { sector: "Tied", n, tbrIqr: 5, scoreIqr: 0, medianTbr: 12, medianScore: 5, tradeable: true },
    ];
    const book = buildLongOnly(scores, companies, dispersion);
    for (const w of book.weights.values()) expect(w.portfolio).toBeCloseTo(w.benchmark, 12);
  });
});

describe("buildLongOnly invariants", () => {
  const companies = syntheticUniverse();
  const { scores } = runScenario(companies, DEFAULT_TEST_CONFIG);
  const book = buildLongOnly(scores, companies, sectorDispersion(scores.values(), DEFAULT_TEST_CONFIG));

  it("holds every sector at benchmark weight and the total at 100%", () => {
    for (const { benchmark, portfolio } of book.sectorWeights.values()) expect(portfolio).toBeCloseTo(benchmark, 9);
    expect([...book.weights.values()].reduce((a, w) => a + w.portfolio, 0)).toBeCloseTo(1, 9);
  });

  it("keeps active weights within ±2pp, no negative weights, and actually tilts", () => {
    for (const w of book.weights.values()) {
      expect(Math.abs(w.active)).toBeLessThanOrEqual(LO_LIMITS.activeLimit + EPS);
      expect(w.portfolio).toBeGreaterThanOrEqual(-EPS);
      if (w.active > EPS) expect(w.portfolio).toBeLessThanOrEqual(Math.max(LO_LIMITS.nameMax, w.benchmark) + EPS);
    }
    expect([...book.weights.values()].some((w) => Math.abs(w.active) > EPS)).toBe(true);
  });
});
