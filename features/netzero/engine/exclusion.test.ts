import { describe, expect, it } from "vitest";
import { buildExclusion, totalEmissions } from "./exclusion";
import { syntheticUniverse } from "./fixtures";

describe("buildExclusion (PDF §9.2 naive comparison)", () => {
  it("drops the top emitting decile and re-weights the rest by float cap", () => {
    const companies = syntheticUniverse();
    const { excluded, weights, sectorWeights } = buildExclusion(companies);
    expect(excluded).toHaveLength(6);
    for (const t of excluded) expect(weights.has(t)).toBe(false);
    expect([...weights.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect([...sectorWeights.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    const smallestExcluded = Math.min(...excluded.map((t) => totalEmissions(companies.find((c) => c.ticker === t)!)!));
    for (const c of companies.filter((x) => weights.has(x.ticker))) {
      expect(totalEmissions(c) ?? 0).toBeLessThanOrEqual(smallestExcluded);
    }
  });

  it("returns null total emissions when every category is missing", () => {
    expect(totalEmissions(syntheticUniverse()[1])).toBeNull();
  });
});
