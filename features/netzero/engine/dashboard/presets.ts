import { DEFAULT_SCORE_IQR_THRESHOLD, DEFAULT_TBR_IQR_THRESHOLD } from "@/features/netzero/engine/types";

import type { Preset, PresetId, RiskAnswers, TrailTolerance } from "./types";

/** User-approved presets; Balanced is exactly the PDF defaults (§8 thresholds, §9.2 ±2pp). */
export const PRESETS: Record<PresetId, Omit<Preset, "robustOnly" | "longShort">> = {
  conservative: {
    id: "conservative",
    label: "Conservative",
    tbrIqrThreshold: DEFAULT_TBR_IQR_THRESHOLD,
    scoreIqrThreshold: DEFAULT_SCORE_IQR_THRESHOLD,
    activeLimit: 0.01,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    tbrIqrThreshold: DEFAULT_TBR_IQR_THRESHOLD,
    scoreIqrThreshold: DEFAULT_SCORE_IQR_THRESHOLD,
    activeLimit: 0.02,
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive",
    tbrIqrThreshold: 0.05,
    scoreIqrThreshold: DEFAULT_SCORE_IQR_THRESHOLD,
    activeLimit: 0.03,
  },
};

const PRESET_BY_TRAIL: Record<TrailTolerance, PresetId> = {
  low: "conservative",
  medium: "balanced",
  high: "aggressive",
};

export const DEFAULT_ANSWERS: RiskAnswers = { trail: "medium", allowShorts: false, robustOnly: false };

export function presetFromAnswers(answers: RiskAnswers): Preset {
  const base = PRESETS[PRESET_BY_TRAIL[answers.trail]];
  return { ...base, robustOnly: answers.robustOnly, longShort: base.id === "aggressive" && answers.allowShorts };
}
