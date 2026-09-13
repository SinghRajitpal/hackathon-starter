import { describe, expect, it } from "vitest";
import { LO_LIMITS, type LongOnlyBook, type LoWeight } from "@/features/netzero/engine/longOnly";

import { neutraliseLongOnly } from "./robust";

function book(rows: LoWeight[]): LongOnlyBook {
  const weights = new Map(rows.map((r) => [r.ticker, r]));
  const sectorWeights = new Map<string, { benchmark: number; portfolio: number }>();
  for (const w of rows) {
    const s = sectorWeights.get(w.sector) ?? { benchmark: 0, portfolio: 0 };
    sectorWeights.set(w.sector, { benchmark: s.benchmark + w.benchmark, portfolio: s.portfolio + w.portfolio });
  }
  return { weights, sectorWeights, events: [] };
}

describe("neutraliseLongOnly", () => {
  it("zeroes non-robust names and redistributes their freed active to the rest of the sector by benchmark weight", () => {
    const b = book([
      { ticker: "A", sector: "S", benchmark: 0.04, portfolio: 0.06, active: 0.02 },
      { ticker: "B", sector: "S", benchmark: 0.01, portfolio: 0.005, active: -0.005 },
      { ticker: "C", sector: "S", benchmark: 0.05, portfolio: 0.035, active: -0.015 },
    ]);
    const out = neutraliseLongOnly(b, new Set(["A"]));

    expect(out.weights.get("A")!.active).toBe(0);
    expect(out.weights.get("A")!.portfolio).toBe(0.04);
    expect(out.weights.get("B")!.active).toBeCloseTo(-0.005 + 0.02 * (0.01 / 0.06), 12);
    expect(out.weights.get("C")!.active).toBeCloseTo(-0.015 + 0.02 * (0.05 / 0.06), 12);

    const sw = out.sectorWeights.get("S")!;
    expect(sw.portfolio).toBeCloseTo(sw.benchmark, 12);
    expect(sw.benchmark).toBeCloseTo(0.1, 12);
  });

  it("leaves benchmark-only names and other sectors untouched", () => {
    const b = book([
      { ticker: "A", sector: "S", benchmark: 0.04, portfolio: 0.06, active: 0.02 },
      { ticker: "B", sector: "S", benchmark: 0.06, portfolio: 0.04, active: -0.02 },
      { ticker: "Z", sector: "Other", benchmark: 0.1, portfolio: 0.1, active: 0 },
    ]);
    const out = neutraliseLongOnly(b, new Set());
    expect(out.weights.get("A")).toEqual(b.weights.get("A"));
    expect(out.weights.get("B")).toEqual(b.weights.get("B"));
    expect(out.weights.get("Z")).toEqual(b.weights.get("Z"));
  });

  it("never pushes a remaining name's active past the limit, even when the freed amount is large", () => {
    const b = book([
      { ticker: "A", sector: "S", benchmark: 0.02, portfolio: 0.03, active: 0.01 },
      { ticker: "B", sector: "S", benchmark: 0.02, portfolio: 0.018, active: -0.002 },
      { ticker: "C", sector: "S", benchmark: 0.02, portfolio: 0.012, active: -0.008 },
    ]);
    const out = neutraliseLongOnly(b, new Set(["A"]), { activeLimit: 0.005, nameMax: LO_LIMITS.nameMax });
    expect(out.weights.get("A")!.active).toBe(0);
    for (const ticker of ["B", "C"]) {
      expect(Math.abs(out.weights.get(ticker)!.active)).toBeLessThanOrEqual(0.005 + 1e-12);
    }
  });
});
