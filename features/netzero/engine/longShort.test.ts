import { describe, expect, it } from "vitest";
import { runEngine } from "./engine";
import { DEFAULT_TEST_CONFIG, PDF_EXAMPLE_CONFIG, PDF_UTILITIES, syntheticUniverse } from "./fixtures";
import { LS_LIMITS, namesPerSide, sizeSector } from "./longShort";
import { groupBySector, runScenario } from "./scenario";

const EPS = 1e-9;

describe("names per side (PDF §9.1)", () => {
  it("uses the quintile with floor 2 and cap 5", () => {
    expect([2, 3, 4, 5, 10, 11, 25, 40].map(namesPerSide)).toEqual([1, 1, 2, 2, 2, 3, 5, 5]);
  });
});

describe("PDF §12 sizing", () => {
  it("goes long U4/U2 and short U5/U1 with the §12 dollar split on 100 M gross", () => {
    const { scores } = runScenario(PDF_UTILITIES, PDF_EXAMPLE_CONFIG);
    const { positions } = sizeSector([...scores.values()], 100e6);
    const dollars = Object.fromEntries(positions.map((p) => [p.ticker, p.side === "long" ? p.weight : -p.weight]));
    expect(Object.keys(dollars).sort()).toEqual(["U1", "U2", "U4", "U5"]);
    expect(dollars.U4 / 1e6).toBeCloseTo(28.2, 0);
    expect(dollars.U2 / 1e6).toBeCloseTo(21.8, 0);
    expect(dollars.U5 / 1e6).toBeCloseTo(-32.4, 0);
    expect(dollars.U1 / 1e6).toBeCloseTo(-17.6, 0);
    expect(Math.abs(dollars.U4) / 50e6).toBeGreaterThan(0.56);
    expect(Math.abs(dollars.U5) / 50e6).toBeGreaterThan(0.64);
  });
});

describe("buildLongShort invariants", () => {
  const book = runEngine(syntheticUniverse(), DEFAULT_TEST_CONFIG).longShort;

  it("is dollar-neutral within gross, name and sector limits", () => {
    expect(book.positions.length).toBeGreaterThan(0);
    expect(Math.abs(book.net)).toBeLessThan(EPS);
    expect(book.gross).toBeLessThanOrEqual(LS_LIMITS.gross + EPS);
    for (const p of book.positions) expect(p.weight).toBeLessThanOrEqual(LS_LIMITS.nameCapOfGross * LS_LIMITS.gross + EPS);
    for (const g of book.sectorGross.values()) expect(g).toBeLessThanOrEqual(LS_LIMITS.sectorCapOfGross * LS_LIMITS.gross + EPS);
  });

  it("matches long and short notionals inside every sector", () => {
    for (const [, members] of groupBySector(book.positions)) {
      const long = members.filter((p) => p.side === "long").reduce((a, p) => a + p.weight, 0);
      const short = members.filter((p) => p.side === "short").reduce((a, p) => a + p.weight, 0);
      expect(long).toBeCloseTo(short, 9);
    }
  });
});
