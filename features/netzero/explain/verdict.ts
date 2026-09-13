import type { DashboardModel } from "@/features/netzero/engine/dashboard/types";
import type { CompanyScore } from "@/features/netzero/engine/scenario";
import { median, quantile } from "@/features/netzero/engine/stats";

import type { VerdictBand } from "./types";

/** Every BUY / HOLD / SELL threshold, in one place. */
export const VERDICT_THRESHOLDS = {
  /** Share of the sector, by composite-score rank, that counts as the top third. */
  topShare: 1 / 3,
  /** Share of the sector, by composite-score rank, that counts as the bottom third. */
  bottomShare: 1 / 3,
  /** SELL when revenue at risk is above this quantile of the sector's revenue at risk. */
  sellRevenueAtRiskQuantile: 0.75,
} as const;

export const VERDICT_RULE_TEXT =
  "BUY = top third of the sector by composite score and revenue at risk at or below the sector median; " +
  "SELL = bottom third of the sector by composite score, or revenue at risk above the sector 75th percentile; " +
  "HOLD = everything else.";

export type VerdictReasonCode =
  | "top_third_score_revenue_at_risk_at_or_below_sector_median"
  | "bottom_third_score"
  | "revenue_at_risk_above_sector_p75"
  | "top_third_score_revenue_at_risk_above_sector_median"
  | "middle_third_score";

export interface Verdict {
  band: VerdictBand;
  reasonCode: VerdictReasonCode;
  /** Sector median of revenue at risk (DE, fraction); null when no company in the sector has DE. */
  sectorMedianRevenueAtRisk: number | null;
  sectorP75RevenueAtRisk: number | null;
}

/**
 * Deterministic verdict from the engine's composite-score rank and revenue at risk (DE).
 * BUY uses "at or below" the median: sectors outside the DE/BEN scope carry DE = 0 for every company,
 * so a strict "below" would rule out BUY for whole sectors (see docs/decisions-log.md).
 */
export function computeVerdict(
  score: Pick<CompanyScore, "rank" | "sectorSize" | "de">,
  sectorScores: Pick<CompanyScore, "de">[],
): Verdict {
  const des = sectorScores.map((s) => s.de).filter((v): v is number => v !== null);
  const sectorMedianRevenueAtRisk = des.length > 0 ? median(des) : null;
  const sectorP75RevenueAtRisk = des.length > 0 ? quantile(des, VERDICT_THRESHOLDS.sellRevenueAtRiskQuantile) : null;
  const result = (band: VerdictBand, reasonCode: VerdictReasonCode): Verdict => ({
    band,
    reasonCode,
    sectorMedianRevenueAtRisk,
    sectorP75RevenueAtRisk,
  });

  const topCut = Math.max(1, Math.ceil(score.sectorSize * VERDICT_THRESHOLDS.topShare));
  const bottomCut = Math.max(1, Math.ceil(score.sectorSize * VERDICT_THRESHOLDS.bottomShare));
  const inTop = score.rank <= topCut;
  const inBottom = !inTop && score.rank > score.sectorSize - bottomCut;
  const atOrBelowMedian = score.de !== null && sectorMedianRevenueAtRisk !== null && score.de <= sectorMedianRevenueAtRisk;
  const aboveP75 = score.de !== null && sectorP75RevenueAtRisk !== null && score.de > sectorP75RevenueAtRisk;

  if (inTop && atOrBelowMedian) return result("BUY", "top_third_score_revenue_at_risk_at_or_below_sector_median");
  if (inBottom) return result("SELL", "bottom_third_score");
  if (aboveP75) return result("SELL", "revenue_at_risk_above_sector_p75");
  if (inTop) return result("HOLD", "top_third_score_revenue_at_risk_above_sector_median");
  return result("HOLD", "middle_third_score");
}

export function verdictForTicker(model: DashboardModel, ticker: string): Verdict | null {
  const score = model.result.scores.get(ticker);
  if (!score) return null;
  const sectorScores = [...model.result.scores.values()].filter((s) => s.sector === score.sector);
  return computeVerdict(score, sectorScores);
}
