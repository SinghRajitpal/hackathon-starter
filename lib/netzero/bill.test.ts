import { describe, expect, it } from "vitest";
import { sectorTbr, transitionBill } from "./bill";
import { MID_MAC, PDF_UTILITIES, syntheticUniverse } from "./fixtures";
import { median, quantile } from "./stats";

describe("transitionBill (PDF §4)", () => {
  it("computes U1's bill as 4,881 million and TBR 0.81 years (PDF §12)", () => {
    expect(transitionBill(PDF_UTILITIES[0].emissions, MID_MAC)).toBeCloseTo(4.881e9, -6);
    expect(sectorTbr(PDF_UTILITIES, MID_MAC).get("U1")!.tbr).toBeCloseTo(0.81, 2);
  });

  it("is null when every category is missing and ignores missing categories otherwise", () => {
    const none = { scope2: null, combustion: null, fleet: null, process: null, fugitive: null };
    expect(transitionBill(none, MID_MAC)).toBeNull();
    expect(transitionBill({ ...none, combustion: 10 }, MID_MAC)).toBe(1200);
  });

  it("floors negative abatement costs at zero so the bill never goes negative", () => {
    const mac = { scope2: -10, combustion: -5, fleet: 0, process: 20, fugitive: -1 };
    for (const c of syntheticUniverse()) expect(transitionBill(c.emissions, mac) ?? 0).toBeGreaterThanOrEqual(0);
  });
});

describe("sectorTbr fallbacks", () => {
  it("imputes the sector median for missing emissions or EBITDA and uses the 97.5th percentile for near-zero EBITDA", () => {
    const energy = syntheticUniverse().filter((c) => c.sector === "Energy");
    const tbr = sectorTbr(energy, MID_MAC);
    expect(tbr.get("ENE1")!.flags).toEqual(["tbr-imputed-no-emissions"]);
    expect(tbr.get("ENE2")!.flags).toEqual(["tbr-imputed-no-ebitda"]);
    const valid = [...tbr.values()].filter((r) => r.flags.length === 0).map((r) => r.tbr);
    expect(tbr.get("ENE1")!.tbr).toBeCloseTo(median(valid));
    expect(tbr.get("ENE2")!.tbr).toBeCloseTo(median(valid));
    expect(tbr.get("ENE0")!.tbr).toBeCloseTo(quantile(valid, 0.975));
    expect(tbr.get("ENE0")!.flags).toEqual(["ebitda-near-zero"]);
  });
});
