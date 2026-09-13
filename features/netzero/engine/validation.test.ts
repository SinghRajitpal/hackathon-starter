import { describe, expect, it } from "vitest";
import type { ValidationRow } from "./types";
import { validationSummary } from "./validation";

const row = (ticker: string, sector: string, tbr2019: number | null, intensityChange: number | null): ValidationRow => ({
  ticker,
  sector,
  tbr2019,
  intensity2019: null,
  intensityLatest: null,
  intensityChange,
});

describe("validationSummary (PDF §11)", () => {
  it("uses only rows with both values and computes Spearman", () => {
    const summary = validationSummary([
      row("A", "Utilities", 0.1, -0.4),
      row("B", "Utilities", 0.5, -0.2),
      row("C", "Energy", 0.9, 0.1),
      row("D", "Energy", null, -0.3),
      row("E", "Energy", 0.3, null),
    ]);
    expect(summary.n).toBe(3);
    expect(summary.spearman).toBeCloseTo(1, 12);
    expect(summary.bySector).toEqual({ Utilities: 2, Energy: 1 });
  });

  it("returns a null correlation below three usable rows", () => {
    expect(validationSummary([row("A", "X", 0.1, -0.1), row("B", "X", 0.2, 0)]).spearman).toBeNull();
    expect(validationSummary([])).toEqual({ n: 0, spearman: null, bySector: {} });
  });

  it("returns a null correlation when a column has zero variance, even with enough rows", () => {
    const summary = validationSummary([
      row("A", "X", 0.3, -0.1),
      row("B", "X", 0.3, 0.2),
      row("C", "X", 0.3, 0.4),
    ]);
    expect(summary.n).toBe(3);
    expect(summary.spearman).toBeNull();
  });
});
