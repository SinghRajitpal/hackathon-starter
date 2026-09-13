import { formatPercent, formatYears } from "@/features/netzero/engine/format";
import { median } from "@/features/netzero/engine/stats";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { companyLabel, SECTOR_VERDICT_TEXT } from "./labels";
import { buildMarketView } from "./market";
import type { CompanyLabel, DashboardModel, Tile } from "./types";

export interface SectorCompanyRow {
  ticker: string;
  name: string;
  score: number;
  /** Years of earnings to clean up (score.tbr). */
  cleanupYears: number;
  revenueAtRisk: number | null;
  revenueUpside: number | null;
  debtLoad: number | null;
  label: CompanyLabel;
  /** Long-only active weight, in percentage points. */
  activePp: number;
}

export function buildSectorView(
  data: ScenarioData,
  model: DashboardModel,
  sector: string,
): { tiles: Tile[]; rows: SectorCompanyRow[]; takeaways: string[] } | null {
  const companies = data.companies.filter((c) => c.sector === sector);
  if (companies.length === 0) return null;

  const market = buildMarketView(data, model);
  const marketRow = market.rows.find((r) => r.sector === sector);
  if (!marketRow) return null;

  const { scores, longOnly } = model.result;
  const rows: SectorCompanyRow[] = [];
  for (const c of companies) {
    const s = scores.get(c.ticker);
    if (!s) continue;
    const active = longOnly.weights.get(c.ticker)?.active ?? 0;
    rows.push({
      ticker: c.ticker,
      name: c.companyName,
      score: s.score,
      cleanupYears: s.tbr,
      revenueAtRisk: s.de,
      revenueUpside: s.ben,
      debtLoad: s.ndEbitda,
      label: companyLabel(s),
      activePp: active * 100,
    });
  }
  rows.sort((a, b) => b.score - a.score);

  const tiles: Tile[] = [
    {
      label: "Cleanup cost",
      value: formatYears(marketRow.cleanupYears),
      sub: "Sector total, years of EBITDA",
      tone: marketRow.cleanupYears >= 0.1 ? "warn" : "neutral",
    },
    { label: "Fossil revenue", value: formatPercent(marketRow.fossilShare), tone: "warn" },
    { label: "Green revenue", value: formatPercent(marketRow.greenShare), tone: "good" },
    { label: "Winner/loser gap", value: formatYears(marketRow.gapYears), sub: SECTOR_VERDICT_TEXT[marketRow.verdict] },
  ];

  const leaders = rows.filter((r) => r.label === "leader");
  const laggards = rows.filter((r) => r.label === "laggard");
  const takeaways: string[] = [];
  if (leaders.length > 0 && laggards.length > 0) {
    const leaderMonths = median(leaders.map((r) => r.cleanupYears)) * 12;
    const laggardMonths = median(laggards.map((r) => r.cleanupYears)) * 12;
    takeaways.push(
      `Leaders' median cleanup cost is ${leaderMonths.toFixed(1)} months of earnings vs ${laggardMonths.toFixed(1)} for laggards.`,
    );
  }
  takeaways.push(`${SECTOR_VERDICT_TEXT[marketRow.verdict]} — ${companies.length} companies in ${sector}.`);

  return { tiles, rows, takeaways: takeaways.slice(0, 3) };
}
