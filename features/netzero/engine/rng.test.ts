import { describe, expect, it } from "vitest";
import { dirichletSample, gammaSample, mulberry32 } from "./rng";

describe("gammaSample", () => {
  it.each([0.5, 3, 40])("has mean ≈ shape and variance ≈ shape for shape %s", (shape) => {
    const rng = mulberry32(123);
    const n = 40000;
    const xs = Array.from({ length: n }, () => gammaSample(shape, rng));
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    expect(Math.abs(mean - shape) / shape).toBeLessThan(0.03);
    expect(Math.abs(variance - shape) / shape).toBeLessThan(0.08);
  });
});

describe("dirichletSample", () => {
  it("sums to 1 and keeps zero alphas at zero", () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 100; k++) {
      const draw = dirichletSample([10, 0, 30], rng);
      expect(draw.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(draw[1]).toBe(0);
      expect(draw[0]).toBeGreaterThan(0);
    }
  });

  it("centres on alpha / sum(alpha)", () => {
    const rng = mulberry32(11);
    const n = 5000;
    let first = 0;
    for (let k = 0; k < n; k++) first += dirichletSample([20, 80], rng)[0];
    expect(first / n).toBeCloseTo(0.2, 2);
  });

  it("returns equal weights when every alpha is zero", () => {
    expect(dirichletSample([0, 0], mulberry32(1))).toEqual([0.5, 0.5]);
  });
});
