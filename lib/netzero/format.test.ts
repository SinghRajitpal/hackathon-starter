import { describe, expect, it } from "vitest";
import { formatPercent, formatRatio, formatTonnes, formatUsd, formatYears } from "./format";

describe("format helpers", () => {
  it("formats dollars with bn/M/k units", () => {
    expect(formatUsd(61.2e9)).toBe("$61.2bn");
    expect(formatUsd(-28.2e6)).toBe("-$28.2M");
    expect(formatUsd(950)).toBe("$950");
    expect(formatUsd(null)).toBe("n/a");
  });
  it("formats tonnes, percents, years and ratios", () => {
    expect(formatTonnes(40.96e6)).toBe("40.96 Mt");
    expect(formatTonnes(1500)).toBe("1.5 kt");
    expect(formatPercent(0.781)).toBe("78%");
    expect(formatPercent(0.0125, 1)).toBe("1.3%");
    expect(formatYears(0.8135)).toBe("0.81 yrs");
    expect(formatRatio(5.79)).toBe("5.8x");
    expect(formatRatio(null)).toBe("n/a");
  });
});
