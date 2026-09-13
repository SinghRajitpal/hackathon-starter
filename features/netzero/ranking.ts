import { companyLabel } from "@/features/netzero/engine/dashboard/labels";
import type { CompanyLabel, DashboardModel } from "@/features/netzero/engine/dashboard/types";
import type { ScenarioData } from "@/features/netzero/engine/types";
import type { VerdictBand } from "@/features/netzero/explain/types";
import { verdictForTicker } from "@/features/netzero/explain/verdict";

export interface NetZeroRankingRow {
  ticker: string;
  companyName: string;
  sector: string;
  score: number;
  /** 1 = best in its sector. Scores are normalised per sector, so ranks do not compare across sectors. */
  rank: number;
  sectorSize: number;
  topPercent: number;
  label: CompanyLabel;
  verdict: VerdictBand | null;
}

/** Every scored company, grouped by sector (A–Z) and ordered by rank inside it. */
export function buildNetZeroRanking(data: ScenarioData, model: DashboardModel): NetZeroRankingRow[] {
  const names = new Map(data.companies.map((c) => [c.ticker, c.companyName]));
  return [...model.result.scores.values()]
    .map((score) => ({
      ticker: score.ticker,
      companyName: names.get(score.ticker) ?? score.ticker,
      sector: score.sector,
      score: score.score,
      rank: score.rank,
      sectorSize: score.sectorSize,
      topPercent: score.topPercent,
      label: companyLabel(score),
      verdict: verdictForTicker(model, score.ticker)?.band ?? null,
    }))
    .sort((a, b) => a.sector.localeCompare(b.sector) || a.rank - b.rank);
}
