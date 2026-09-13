import { allocateLongOnly, allocateLongShort, toCsv, type AllocationRow } from "@/features/netzero/engine/allocation";
import { reasonSentence } from "@/features/netzero/engine/reasons";
import { formatPercent, formatYears } from "@/features/netzero/engine/format";
import type { ScenarioData } from "@/features/netzero/engine/types";

import type { DashboardModel, Tile } from "./types";

export interface PortfolioMetrics {
  cleanupYears: number;
  carbonCostPerMillion: number;
  fossilShare: number;
  greenShare: number;
}

/** Weighted portfolio metrics for any weight vector (portfolio, benchmark or exclusion). */
export function portfolioMetrics(data: ScenarioData, model: DashboardModel, weights: Map<string, number>): PortfolioMetrics {
  const companies = new Map(data.companies.map((c) => [c.ticker, c]));
  let cleanupYears = 0;
  let carbonCostPerMillion = 0;
  let fossilShare = 0;
  let greenShare = 0;
  for (const [ticker, w] of weights) {
    if (!w) continue;
    const score = model.result.scores.get(ticker);
    if (!score) continue;
    cleanupYears += w * score.tbr;
    fossilShare += w * (score.de ?? 0);
    greenShare += w * (score.ben ?? 0);
    const floatCap = companies.get(ticker)?.floatCap ?? null;
    if (score.bill !== null && floatCap !== null && floatCap > 0) {
      carbonCostPerMillion += (w * score.bill * 1e6) / floatCap;
    }
  }
  return { cleanupYears, carbonCostPerMillion, fossilShare, greenShare };
}

/** Half sum of absolute weight differences over the union of both books' tickers. */
function activeShare(a: Map<string, number>, b: Map<string, number>): number {
  const tickers = new Set([...a.keys(), ...b.keys()]);
  let total = 0;
  for (const t of tickers) total += Math.abs((a.get(t) ?? 0) - (b.get(t) ?? 0));
  return total / 2;
}

export type ComparisonFormat = "years" | "percent" | "usd";

export interface ComparisonRow {
  metric: string;
  format: ComparisonFormat;
  portfolio: number;
  benchmark: number;
  exclusion: number;
}

export interface SectorBet {
  sector: string;
  /** Weight moved from laggards to leaders inside the sector (Σ|active| ÷ 2), in percentage points. */
  movedPp: number;
}

export interface OverUnderRow {
  ticker: string;
  name: string;
  sector: string;
  activePp: number;
  dollars: number;
  reason: string;
}

export interface PortfolioDashboard {
  tiles: Tile[];
  comparison: ComparisonRow[];
  sectorBets: SectorBet[];
  overweights: OverUnderRow[];
  underweights: OverUnderRow[];
  robustnessText: string;
  takeaways: string[];
  csv: string;
  longShort: AllocationRow[] | null;
}

export function buildPortfolioDashboard(data: ScenarioData, model: DashboardModel): PortfolioDashboard {
  const { longOnly, exclusion, scores, dispersion } = model.result;
  const capital = model.adjust.capital;

  const portfolioWeights = new Map([...longOnly.weights.values()].map((w) => [w.ticker, w.portfolio]));
  const benchmarkWeights = new Map([...longOnly.weights.values()].map((w) => [w.ticker, w.benchmark]));
  const exclusionWeights = exclusion.weights;

  const portfolioM = portfolioMetrics(data, model, portfolioWeights);
  const benchmarkM = portfolioMetrics(data, model, benchmarkWeights);
  const exclusionM = portfolioMetrics(data, model, exclusionWeights);

  const portfolioActiveShare = activeShare(portfolioWeights, benchmarkWeights);
  const exclusionActiveShare = activeShare(exclusionWeights, benchmarkWeights);

  const comparison: ComparisonRow[] = [
    { metric: "Cleanup burden (years of earnings)", format: "years", portfolio: portfolioM.cleanupYears, benchmark: benchmarkM.cleanupYears, exclusion: exclusionM.cleanupYears },
    { metric: "Fossil revenue share", format: "percent", portfolio: portfolioM.fossilShare, benchmark: benchmarkM.fossilShare, exclusion: exclusionM.fossilShare },
    { metric: "Green revenue share", format: "percent", portfolio: portfolioM.greenShare, benchmark: benchmarkM.greenShare, exclusion: exclusionM.greenShare },
    { metric: "Carbon cost per USD 1M invested", format: "usd", portfolio: portfolioM.carbonCostPerMillion, benchmark: benchmarkM.carbonCostPerMillion, exclusion: exclusionM.carbonCostPerMillion },
    { metric: "Active share", format: "percent", portfolio: portfolioActiveShare, benchmark: 0, exclusion: exclusionActiveShare },
  ];

  const moved = new Map<string, number>();
  for (const w of longOnly.weights.values()) moved.set(w.sector, (moved.get(w.sector) ?? 0) + Math.abs(w.active) / 2);
  const sectorBets: SectorBet[] = [...moved.entries()]
    .map(([sector, m]) => ({ sector, movedPp: m * 100 }))
    .filter((b) => b.movedPp > 0.005)
    .sort((a, b) => b.movedPp - a.movedPp);

  const companies = new Map(data.companies.map((c) => [c.ticker, c]));
  const medianTbr = new Map(dispersion.map((d) => [d.sector, d.medianTbr]));

  function overUnderRow(w: { ticker: string; sector: string; active: number }): OverUnderRow {
    const company = companies.get(w.ticker);
    const score = scores.get(w.ticker);
    const position = w.active > 0 ? "overweight" : "underweight";
    return {
      ticker: w.ticker,
      name: company?.companyName ?? w.ticker,
      sector: w.sector,
      activePp: w.active * 100,
      dollars: w.active * capital,
      reason: score ? reasonSentence(score, position, medianTbr.get(w.sector) ?? 0) : "Not scored in the scenario universe.",
    };
  }

  const active = [...longOnly.weights.values()].filter((w) => Math.abs(w.active) > 1e-9);
  const overweights = active
    .filter((w) => w.active > 0)
    .sort((a, b) => b.active - a.active)
    .slice(0, 10)
    .map(overUnderRow);
  const underweights = active
    .filter((w) => w.active < 0)
    .sort((a, b) => a.active - b.active)
    .slice(0, 10)
    .map(overUnderRow);

  const robustnessText = model.stress
    ? `${formatPercent(model.stress.headline)} of picks hold direction across cost scenarios and weight draws (${model.stress.draws} draws).`
    : "Robustness has not been computed for this book yet.";

  const tiles: Tile[] = [
    {
      label: "Cleanup burden vs S&P 500",
      value: benchmarkM.cleanupYears > 0 ? formatPercent((portfolioM.cleanupYears - benchmarkM.cleanupYears) / benchmarkM.cleanupYears) : "n/a",
      sub: `${formatYears(portfolioM.cleanupYears)} vs ${formatYears(benchmarkM.cleanupYears)}`,
    },
    {
      label: "Fossil revenue vs S&P 500",
      value: `${((portfolioM.fossilShare - benchmarkM.fossilShare) * 100).toFixed(1)}pp`,
      tone: portfolioM.fossilShare < benchmarkM.fossilShare ? "good" : "bad",
    },
    {
      label: "Green revenue vs S&P 500",
      value: `${((portfolioM.greenShare - benchmarkM.greenShare) * 100).toFixed(1)}pp`,
      tone: portfolioM.greenShare > benchmarkM.greenShare ? "good" : "bad",
    },
    { label: "Active share", value: formatPercent(portfolioActiveShare) },
    { label: "Robust picks", value: model.stress ? formatPercent(model.stress.headline) : "n/a" },
  ];

  const takeaways: string[] = [];
  if (benchmarkM.cleanupYears > 0) {
    const dir = portfolioM.cleanupYears < benchmarkM.cleanupYears ? "lower" : "higher";
    takeaways.push(`The book carries a ${dir} cleanup burden than the S&P 500: ${formatYears(portfolioM.cleanupYears)} vs ${formatYears(benchmarkM.cleanupYears)}.`);
  }
  if (sectorBets.length > 0) {
    const biggest = sectorBets[0];
    takeaways.push(`Largest tilt: ${biggest.movedPp.toFixed(1)}pp of weight moved from laggards to leaders inside ${biggest.sector}; sector weights stay at benchmark.`);
  }
  takeaways.push(robustnessText);

  const csv = model.preset.longShort
    ? toCsv(allocateLongShort(model.result.longShort, scores, data.companies, dispersion, capital))
    : toCsv(allocateLongOnly(longOnly, scores, data.companies, dispersion, capital));

  const longShort = model.preset.longShort
    ? allocateLongShort(model.result.longShort, scores, data.companies, dispersion, capital)
    : null;

  return { tiles, comparison, sectorBets, overweights, underweights, robustnessText, takeaways: takeaways.slice(0, 3), csv, longShort };
}
