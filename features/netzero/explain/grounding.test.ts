import { describe, expect, it } from "vitest";

import { validateGrounding } from "./grounding";

const packet = {
  schema_version: 1,
  generated_at: "2026-09-13T10:20:30.000Z",
  ticker: "MMM",
  company_name: "3M Company",
  transition_bill_to_ebitda_years: 1.13,
  revenue_at_risk_pct: 45.67,
  cleanup_cost_usd_m: 12345.67,
  green_revenue_share_pct: 12.35,
  net_exposure_pct: 30,
  rank_in_sector: 3,
  sector_size: 22,
  verdict_rule: "SELL = revenue at risk above the sector 75th percentile",
  top_longs: [{ ticker: "AAA", active_weight_pp: -1.25 }],
};

const check = (text: string) => validateGrounding({ line: text, list: [text] }, packet);

describe("validateGrounding", () => {
  it("accepts numbers copied from the packet", () => {
    expect(check("Cleanup costs 1.13 years of earnings, rank 3 of 22.").ok).toBe(true);
  });

  it("accepts one dropped decimal, separators, currency, percent and B/bn/billion suffixes", () => {
    for (const text of ["1.1 years", "45.7%", "$12,345.67 million", "$12,345.67M", "$12.3bn", "$12.35B", "$12.35 billion", "$12bn"]) {
      expect(check(text), text).toEqual({ ok: true, unmatched: [] });
    }
  });

  it("accepts either rounding of a value that sits on a rounding boundary", () => {
    expect(check("green revenue 12.4%").ok).toBe(true);
    expect(check("green revenue 12.3%").ok).toBe(true);
  });

  it("rejects rounding that drops more than one decimal place", () => {
    expect(check("46% of revenue")).toEqual({ ok: false, unmatched: ["46", "46"] });
  });

  it("accepts a minus sign only on a negative packet value, and magnitudes without a sign", () => {
    expect(check("underweight −1.25pp").ok).toBe(true);
    expect(check("underweight 1.25pp").ok).toBe(true);
    expect(check("net exposure -30%")).toEqual({ ok: false, unmatched: ["-30", "-30"] });
  });

  it("accepts figures that appear inside packet strings and the S&P 500 name", () => {
    expect(check("3M sits above the 75th percentile of S&P 500 peers.").ok).toBe(true);
  });

  it("rejects a number that is not in the packet", () => {
    expect(check("A 15% drop in demand.")).toEqual({ ok: false, unmatched: ["15", "15"] });
  });

  it("does not allow the generation timestamp as a source of figures", () => {
    expect(check("By 2026 the bill falls.").ok).toBe(false);
  });

  it("rejects ratios written as words", () => {
    const result = validateGrounding({ line: "Its bill is nearly triple the median and twice its peer's." }, packet);
    expect(result).toEqual({ ok: false, unmatched: ["triple", "twice"] });
  });

  it("checks nested arrays of strings", () => {
    const result = validateGrounding({ drivers: ["rank 3", "score 99.5"] }, packet);
    expect(result).toEqual({ ok: false, unmatched: ["99.5"] });
  });
});
