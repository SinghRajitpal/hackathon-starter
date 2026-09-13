import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";
import { iqr, median, quantile, spearman } from "./stats";

describe("stats", () => {
  it("matches numpy linear quantiles", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(median([3, 1, 2])).toBe(2);
    expect(iqr([1, 2, 3, 4, 5])).toBeCloseTo(2);
    expect(iqr([])).toBe(0);
  });

  it("computes Spearman rank correlation with ties", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 1, 2], [1, 2, 3])).toBeCloseTo(0.866, 3);
  });
});

describe("mulberry32", () => {
  it("is deterministic for a seed and stays in [0, 1)", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(xs);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
  });
});
