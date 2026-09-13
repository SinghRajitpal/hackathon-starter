import { describe, expect, it } from "vitest";

import { computeVerdict } from "./verdict";

// Nine companies with revenue at risk 0.1 … 0.9: median 0.5, 75th percentile 0.7; top third = ranks 1–3.
const sector = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((de) => ({ de }));

describe("computeVerdict", () => {
  it("is BUY for a top-third company with revenue at risk below the sector median", () => {
    const v = computeVerdict({ rank: 1, sectorSize: 9, de: 0.1 }, sector);
    expect(v.band).toBe("BUY");
    expect(v.reasonCode).toBe("top_third_score_revenue_at_risk_at_or_below_sector_median");
    expect(v.sectorMedianRevenueAtRisk).toBeCloseTo(0.5);
    expect(v.sectorP75RevenueAtRisk).toBeCloseTo(0.7);
  });

  it("is BUY at the median, so sectors where every company has zero revenue at risk can still have BUYs", () => {
    const zeros = Array.from({ length: 9 }, () => ({ de: 0 }));
    expect(computeVerdict({ rank: 2, sectorSize: 9, de: 0 }, zeros).band).toBe("BUY");
    expect(computeVerdict({ rank: 5, sectorSize: 9, de: 0 }, zeros).band).toBe("HOLD");
    expect(computeVerdict({ rank: 9, sectorSize: 9, de: 0 }, zeros).band).toBe("SELL");
  });

  it("is HOLD for a top-third company whose revenue at risk is above the median", () => {
    const v = computeVerdict({ rank: 2, sectorSize: 9, de: 0.6 }, sector);
    expect(v).toMatchObject({ band: "HOLD", reasonCode: "top_third_score_revenue_at_risk_above_sector_median" });
  });

  it("is SELL for a bottom-third company even with low revenue at risk", () => {
    const v = computeVerdict({ rank: 8, sectorSize: 9, de: 0.1 }, sector);
    expect(v).toMatchObject({ band: "SELL", reasonCode: "bottom_third_score" });
  });

  it("is SELL for a middle-ranked company with revenue at risk above the sector 75th percentile", () => {
    const v = computeVerdict({ rank: 5, sectorSize: 9, de: 0.9 }, sector);
    expect(v).toMatchObject({ band: "SELL", reasonCode: "revenue_at_risk_above_sector_p75" });
  });

  it("is HOLD for a middle-ranked company with ordinary revenue at risk", () => {
    const v = computeVerdict({ rank: 5, sectorSize: 9, de: 0.4 }, sector);
    expect(v).toMatchObject({ band: "HOLD", reasonCode: "middle_third_score" });
  });

  it("never gives BUY when revenue at risk was not computed", () => {
    expect(computeVerdict({ rank: 1, sectorSize: 9, de: null }, sector).band).toBe("HOLD");
  });

  it("does not call the only company in a sector bottom third", () => {
    const v = computeVerdict({ rank: 1, sectorSize: 1, de: null }, [{ de: null }]);
    expect(v).toMatchObject({ band: "HOLD", sectorMedianRevenueAtRisk: null, sectorP75RevenueAtRisk: null });
  });
});
