import { runEngine } from "@/lib/netzero/engine";
import { buildLongOnly, LO_LIMITS } from "@/lib/netzero/longOnly";
import { configFromControls, DEFAULT_CONTROLS } from "@/lib/netzero/portfolio";
import { runSensitivity } from "@/lib/netzero/sensitivity";
import type { ScenarioData } from "@/lib/netzero/types";

import { presetFromAnswers } from "./presets";
import { neutraliseLongOnly } from "./robust";
import type { AdjustControls, DashboardModel, RiskAnswers } from "./types";

export const DEFAULT_ADJUST: AdjustControls = { capital: DEFAULT_CONTROLS.capital, macPoint: DEFAULT_CONTROLS.macPoint };

/** Draws for the dashboard's stress test: lower than the PDF §11 default (1,000) to stay fast on every preset change. */
export const DASHBOARD_STRESS_DRAWS = 300;
export const DASHBOARD_STRESS_SEED = 42;

/**
 * One engine run for the chosen risk answers: applies the preset's thresholds and mandate (from the
 * scaffold), then rebuilds the long-only book at the preset's active limit, runs the stress test for
 * that book, and — when the preset asks for robust picks only — holds non-robust names at benchmark.
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
  const limits = { activeLimit: preset.activeLimit, nameMax: LO_LIMITS.nameMax };
  let longOnly = buildLongOnly(result.scores, data.companies, result.dispersion, limits);

  const stress = runSensitivity(data.companies, config, { draws: DASHBOARD_STRESS_DRAWS, seed: DASHBOARD_STRESS_SEED, limits });

  if (preset.robustOnly) {
    const nonRobust = new Set(stress.picks.filter((p) => !p.robust).map((p) => p.ticker));
    longOnly = neutraliseLongOnly(longOnly, nonRobust, limits);
  }

  return { preset, answers, adjust, config, result: { ...result, longOnly }, stress };
}
