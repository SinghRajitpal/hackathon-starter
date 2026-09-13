import { runEngine } from "@/lib/netzero/engine";
import { configFromControls, DEFAULT_CONTROLS } from "@/lib/netzero/portfolio";
import type { ScenarioData } from "@/lib/netzero/types";

import { presetFromAnswers } from "./presets";
import type { AdjustControls, DashboardModel, RiskAnswers } from "./types";

export const DEFAULT_ADJUST: AdjustControls = { capital: DEFAULT_CONTROLS.capital, macPoint: DEFAULT_CONTROLS.macPoint };

/**
 * One engine run for the chosen risk answers. Scaffold version: applies the preset thresholds and mandate.
 * The engine task extends it (active limit, stress test, robust-only filter) without changing the signature.
 */
export function buildDashboardModel(data: ScenarioData, answers: RiskAnswers, adjust: AdjustControls = DEFAULT_ADJUST): DashboardModel {
  const preset = presetFromAnswers(answers);
  const { config } = configFromControls(data, {
    ...DEFAULT_CONTROLS,
    capital: adjust.capital,
    macPoint: adjust.macPoint,
    mandate: preset.longShort ? "long-short" : "long-only",
    tbrIqrThreshold: preset.tbrIqrThreshold,
    scoreIqrThreshold: preset.scoreIqrThreshold,
  });
  const result = runEngine(data.companies, config);
  return { preset, answers, adjust, config, result, stress: null };
}
