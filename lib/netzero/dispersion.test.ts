import { describe, expect, it } from "vitest";
import { sectorDispersion } from "./dispersion";
import { runEngine } from "./engine";
import { DEFAULT_TEST_CONFIG, PDF_EXAMPLE_CONFIG, PDF_UTILITIES, syntheticUniverse } from "./fixtures";
import { runScenario } from "./scenario";

describe("sectorDispersion (PDF §8)", () => {
  it("marks the §12 utilities tradeable with a TBR IQR of about 0.4 years", () => {
    const { scores } = runScenario(PDF_UTILITIES, PDF_EXAMPLE_CONFIG);
    const [utilities] = sectorDispersion(scores.values(), PDF_EXAMPLE_CONFIG);
    expect(utilities.tbrIqr).toBeGreaterThan(0.35);
    expect(utilities.tbrIqr).toBeLessThan(0.5);
    expect(utilities.medianScore).toBeCloseTo(44.0, 0);
    expect(utilities.tradeable).toBe(true);
  });

  it("orders sectors by score IQR and applies either threshold", () => {
    const { scores } = runScenario(syntheticUniverse(), DEFAULT_TEST_CONFIG);
    const rows = sectorDispersion(scores.values(), DEFAULT_TEST_CONFIG);
    expect(rows.map((r) => r.scoreIqr)).toEqual([...rows.map((r) => r.scoreIqr)].sort((a, b) => b - a));
    for (const r of rows) expect(r.tradeable).toBe(r.tbrIqr > 0.25 || r.scoreIqr > 25);
    const strict = sectorDispersion(scores.values(), { tbrIqrThreshold: 1e9, scoreIqrThreshold: 1e9 });
    expect(strict.every((r) => !r.tradeable)).toBe(true);
  });

  it("is exposed by runEngine", () => {
    expect(runEngine(syntheticUniverse(), DEFAULT_TEST_CONFIG).dispersion).toHaveLength(4);
  });
});
