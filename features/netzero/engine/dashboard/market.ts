import { formatPercent, formatUsd, formatYears } from "@/features/netzero/engine/format";
import type { CompanyInput, ScenarioData } from "@/features/netzero/engine/types";

import type { DashboardModel, SectorVerdict, Tile } from "./types";

export interface MarketRow {
  sector: string;
  n: number;
  /** Σ bill ÷ Σ positive EBITDA, in years of sector EBITDA. */
  cleanupYears: number;
  billUsd: number;
  /** Revenue-weighted fossil (DE) share; null DE treated as 0. */
  fossilShare: number;
  /** Revenue-weighted beneficiary (BEN) share; null BEN treated as 0. */
  greenShare: number;
  /** TBR IQR — the winner/loser gap inside the sector. */
  gapYears: number;
  verdict: SectorVerdict;
}

const VERDICT_ORDER: Record<SectorVerdict, number> = { "pick-winners": 0, "sector-hit": 1, "barely-affected": 2 };

/** PDF §8 verdict: tradeable sectors let you pick winners; non-tradeable but fossil-heavy sectors are hit whole. */
export function sectorVerdict(row: { tradeable: boolean; fossilShare: number; cleanupYears: number }): SectorVerdict {
  if (row.tradeable) return "pick-winners";
  if (row.fossilShare >= 0.5 || row.cleanupYears >= 0.1) return "sector-hit";
  return "barely-affected";
}

function groupBySector(companies: CompanyInput[]): Map<string, CompanyInput[]> {
  const out = new Map<string, CompanyInput[]>();
  for (const c of companies) {
    const list = out.get(c.sector) ?? [];
    list.push(c);
    out.set(c.sector, list);
  }
  return out;
}

export function buildMarketView(data: ScenarioData, model: DashboardModel): { tiles: Tile[]; rows: MarketRow[]; takeaways: string[] } {
  const { scores, dispersion } = model.result;
  const rows: MarketRow[] = [];

  for (const [sector, companies] of groupBySector(data.companies)) {
    const disp = dispersion.find((d) => d.sector === sector);
    let bill = 0;
    let positiveEbitda = 0;
    let revenue = 0;
    let fossilRevenue = 0;
    let greenRevenue = 0;
    for (const c of companies) {
      bill += scores.get(c.ticker)?.bill ?? 0;
      if (c.ebitdaTtm !== null && c.ebitdaTtm > 0) positiveEbitda += c.ebitdaTtm;
      const rev = c.revenueTtm ?? 0;
      revenue += rev;
      fossilRevenue += rev * (c.de ?? 0);
      greenRevenue += rev * (c.ben ?? 0);
    }
    const cleanupYears = positiveEbitda > 0 ? bill / positiveEbitda : 0;
    const fossilShare = revenue > 0 ? fossilRevenue / revenue : 0;
    const greenShare = revenue > 0 ? greenRevenue / revenue : 0;
    const verdict = sectorVerdict({ tradeable: disp?.tradeable ?? false, fossilShare, cleanupYears });
    rows.push({ sector, n: companies.length, cleanupYears, billUsd: bill, fossilShare, greenShare, gapYears: disp?.tbrIqr ?? 0, verdict });
  }

  rows.sort((a, b) => {
    if (VERDICT_ORDER[a.verdict] !== VERDICT_ORDER[b.verdict]) return VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict];
    if (a.verdict === "pick-winners") return b.gapYears - a.gapYears;
    if (a.verdict === "sector-hit") return b.cleanupYears - a.cleanupYears;
    return a.sector.localeCompare(b.sector);
  });

  const totalBill = rows.reduce((a, r) => a + r.billUsd, 0);
  const totalPositiveEbitda = data.companies.reduce((a, c) => a + (c.ebitdaTtm !== null && c.ebitdaTtm > 0 ? c.ebitdaTtm : 0), 0);
  const totalRevenue = data.companies.reduce((a, c) => a + (c.revenueTtm ?? 0), 0);
  const totalFossilRevenue = data.companies.reduce((a, c) => a + (c.revenueTtm ?? 0) * (c.de ?? 0), 0);
  const totalGreenRevenue = data.companies.reduce((a, c) => a + (c.revenueTtm ?? 0) * (c.ben ?? 0), 0);
  const indexCleanupYears = totalPositiveEbitda > 0 ? totalBill / totalPositiveEbitda : 0;
  const pickWinnersCount = rows.filter((r) => r.verdict === "pick-winners").length;

  const tiles: Tile[] = [
    { label: "Cleanup cost", value: formatUsd(totalBill), sub: `${formatYears(indexCleanupYears)} of index EBITDA` },
    { label: "Fossil revenue", value: formatPercent(totalRevenue > 0 ? totalFossilRevenue / totalRevenue : 0), tone: "warn" },
    { label: "Green revenue", value: formatPercent(totalRevenue > 0 ? totalGreenRevenue / totalRevenue : 0), tone: "good" },
    { label: "Sectors to pick winners", value: String(pickWinnersCount) },
  ];

  const takeaways: string[] = [];
  const widestGap = [...rows].sort((a, b) => b.gapYears - a.gapYears)[0];
  if (widestGap) takeaways.push(`${widestGap.sector} has the widest winner/loser gap (${formatYears(widestGap.gapYears)}).`);
  const mostFossil = [...rows].sort((a, b) => b.fossilShare - a.fossilShare)[0];
  if (mostFossil) takeaways.push(`${mostFossil.sector} is the most fossil-exposed sector (${formatPercent(mostFossil.fossilShare)} of revenue).`);
  const barelyAffected = rows.filter((r) => r.verdict === "barely-affected").length;
  takeaways.push(`${barelyAffected} of ${rows.length} sectors are barely affected.`);

  return { tiles, rows, takeaways: takeaways.slice(0, 3) };
}
