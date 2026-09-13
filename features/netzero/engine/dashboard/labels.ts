import type { CompanyScore } from "@/features/netzero/engine/scenario";

import type { CompanyLabel, SectorVerdict, Tone } from "./types";

/** Leader = top quintile of the sector by rank, Laggard = bottom quintile (PDF §9 quintiles). */
export function companyLabel(score: Pick<CompanyScore, "rank" | "sectorSize">): CompanyLabel {
  const q = Math.max(1, Math.ceil(score.sectorSize / 5));
  if (score.rank <= q) return "leader";
  if (score.rank > score.sectorSize - q) return "laggard";
  return "middle";
}

export const COMPANY_LABEL_TEXT: Record<CompanyLabel, string> = { leader: "Leader", middle: "Middle", laggard: "Laggard" };
export const COMPANY_LABEL_TONE: Record<CompanyLabel, Tone> = { leader: "good", middle: "neutral", laggard: "bad" };

export const SECTOR_VERDICT_TEXT: Record<SectorVerdict, string> = {
  "pick-winners": "Pick winners here",
  "sector-hit": "Whole sector hit",
  "barely-affected": "Barely affected",
};
export const SECTOR_VERDICT_TONE: Record<SectorVerdict, Tone> = {
  "pick-winners": "good",
  "sector-hit": "bad",
  "barely-affected": "neutral",
};

export const TONE_CLASS: Record<Tone, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  bad: "text-red-600 dark:text-red-400",
  warn: "text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
};
