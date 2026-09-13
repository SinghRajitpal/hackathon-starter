import { describe, expect, it } from "vitest";

import { DEFAULT_ANSWERS, presetFromAnswers } from "./presets";

describe("presetFromAnswers", () => {
  it("defaults to Balanced with the PDF thresholds and ±2pp", () => {
    const p = presetFromAnswers(DEFAULT_ANSWERS);
    expect(p).toMatchObject({ id: "balanced", tbrIqrThreshold: 0.25, scoreIqrThreshold: 25, activeLimit: 0.02, longShort: false });
  });

  it("maps a low trail tolerance to Conservative at ±1pp", () => {
    expect(presetFromAnswers({ trail: "low", allowShorts: true, robustOnly: true })).toMatchObject({
      id: "conservative",
      activeLimit: 0.01,
      robustOnly: true,
      longShort: false,
    });
  });

  it("only allows the long/short book for Aggressive with shorting allowed", () => {
    expect(presetFromAnswers({ trail: "high", allowShorts: true, robustOnly: false })).toMatchObject({
      id: "aggressive",
      tbrIqrThreshold: 0.05,
      activeLimit: 0.03,
      longShort: true,
    });
    expect(presetFromAnswers({ trail: "high", allowShorts: false, robustOnly: false }).longShort).toBe(false);
  });
});
