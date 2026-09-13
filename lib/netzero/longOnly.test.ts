import { describe, expect, it } from "vitest";
import { sectorDispersion } from "./dispersion";
import { DEFAULT_TEST_CONFIG, syntheticUniverse } from "./fixtures";
import { buildLongOnly, LO_LIMITS, tiltSector } from "./longOnly";
import { runScenario } from "./scenario";

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
