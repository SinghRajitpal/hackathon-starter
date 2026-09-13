import { describe, expect, it } from "vitest";
import { capWeights, entropyWeights } from "./entropy";
import { topsis } from "./topsis";

describe("entropy weights (PDF §7)", () => {
  it("gives a constant column zero weight", () => {
    const w = entropyWeights([[1, 1, 1], [0, 0.5, 1]]);
    expect(w[0]).toBeCloseTo(0);
    expect(w[1]).toBeCloseTo(1);
  });

  it("caps at 0.40 and redistributes proportionally", () => {
    const { weights, events } = capWeights([0.7, 0.2, 0.1], 0.4, ["a", "b", "c"]);
    expect(weights[0]).toBeCloseTo(0.4);
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(events.length).toBeGreaterThan(0);
  });

  it("relaxes the cap when too few variables carry weight", () => {
    const { weights, cap } = capWeights([0.9, 0.1, 0, 0, 0], 0.4, ["a", "b", "c", "d", "e"]);
    expect(cap).toBeCloseTo(0.5);
    expect(weights[0]).toBeCloseTo(0.5);
  });

  it("leaves weights untouched when the cap is null", () => {
    expect(capWeights([0.7, 0.3], null, ["a", "b"]).weights).toEqual([0.7, 0.3]);
  });
});

describe("topsis", () => {
  it("scores the ideal 100, the anti-ideal 0 and the midpoint 50 with equal shares", () => {
    const rows = topsis([[1, 1], [0, 0], [0.5, 0.5]], [0.5, 0.5]);
    expect(rows.map((r) => r.score)).toEqual([100, 0, 50]);
    expect(rows[2].shares).toEqual([0.5, 0.5]);
  });
});
