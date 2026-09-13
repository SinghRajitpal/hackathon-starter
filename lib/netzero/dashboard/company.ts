import { reasonSentence, type PositionLabel } from "@/lib/netzero/explain";
import { formatPercent, formatRatio, formatUsd, formatYears } from "@/lib/netzero/format";
import type { CompanyScore } from "@/lib/netzero/scenario";
import { PICK_ACTIVE_THRESHOLD } from "@/lib/netzero/sensitivity";
import { median } from "@/lib/netzero/stats";
import { CATEGORIES, CATEGORY_LABEL, type Category, type ScenarioData } from "@/lib/netzero/types";

import { COMPANY_LABEL_TEXT, companyLabel } from "./labels";
import type { CompanyLabel, DashboardModel, Tile } from "./types";

const QUINTILE_TEXT: Record<CompanyLabel, string> = { leader: "top 20%", middle: "middle 60%", laggard: "bottom 20%" };

export interface CompanyHeader {
  ticker: string;
  name: string;
  sector: string;
  subIndustry: string;
  label: CompanyLabel;
  verdictText: string;
  score: number;
  rank: number;
  sectorSize: number;
}

export interface BillSplitRow {
  category: Category;
  label: string;
  usd: number | null;
}

export interface CompanyPeer {
  ticker: string;
  score: number;
  isSelf: boolean;
}

export interface CompanyBadges {
  robust: "holds" | "does-not-hold" | "no-position";
  data: "reported" | "estimated";
}

export interface CompanyView {
  header: CompanyHeader;
  tiles: Tile[];
  billSplit: BillSplitRow[];
  peers: CompanyPeer[];
  reason: string;
  stance: string;
  badges: CompanyBadges;
  takeaways: string[];
}

/** Sector medians for the four ratio tiles, computed from the same engine scores as the sector screen. */
function sectorMedians(scores: CompanyScore[]) {
  const only = (values: (number | null)[]) => values.filter((v): v is number => v !== null);
  return {
    tbr: median(scores.map((s) => s.tbr)),
    de: median(only(scores.map((s) => s.de))),
    ben: median(only(scores.map((s) => s.ben))),
    ndEbitda: median(only(scores.map((s) => s.ndEbitda))),
  };
}

function tileTone(value: number | null, sectorMedian: number, higherIsWorse: boolean): Tile["tone"] {
  if (value === null) return "neutral";
  if (value === sectorMedian) return "neutral";
  const worse = higherIsWorse ? value > sectorMedian : value < sectorMedian;
  return worse ? "bad" : "good";
}

function positionAndStance(active: number): { position: PositionLabel; stance: string } {
  if (Math.abs(active) < PICK_ACTIVE_THRESHOLD) return { position: "benchmark", stance: "Held at benchmark" };
  const pp = Math.abs(active * 100).toFixed(1);
  if (active > 0) return { position: "overweight", stance: `Overweight +${pp}pp` };
  return { position: "underweight", stance: `Underweight −${pp}pp` };
}

export function buildCompanyView(data: ScenarioData, model: DashboardModel, ticker: string): CompanyView | null {
  const score = model.result.scores.get(ticker);
  const company = data.companies.find((c) => c.ticker === ticker);
  if (!score || !company) return null;

  const sectorScores = [...model.result.scores.values()].filter((s) => s.sector === score.sector);
  const medians = sectorMedians(sectorScores);

  const label = companyLabel(score);
  const header: CompanyHeader = {
    ticker: score.ticker,
    name: company.companyName,
    sector: score.sector,
    subIndustry: company.subIndustry,
    label,
    verdictText: `${COMPANY_LABEL_TEXT[label]} · ${QUINTILE_TEXT[label]} of ${score.sector}`,
    score: score.score,
    rank: score.rank,
    sectorSize: score.sectorSize,
  };

  const tiles: Tile[] = [
    {
      label: "Cleanup cost",
      value: `${formatYears(score.tbr)} · ${formatUsd(score.bill)}`,
      sub: `Sector median ${formatYears(medians.tbr)}`,
      tone: tileTone(score.tbr, medians.tbr, true),
    },
    {
      label: "Revenue at risk",
      value: formatPercent(score.de),
      sub: `Sector median ${formatPercent(medians.de)}`,
      tone: tileTone(score.de, medians.de, true),
    },
    {
      label: "Revenue upside",
      value: formatPercent(score.ben),
      sub: `Sector median ${formatPercent(medians.ben)}`,
      tone: tileTone(score.ben, medians.ben, false),
    },
    {
      label: "Can it pay",
      value: `${formatRatio(score.ndEbitda)} debt load`,
      sub: `FCF margin ${formatPercent(score.fcfMargin)} · sector median ${formatRatio(medians.ndEbitda)}`,
      tone: tileTone(score.ndEbitda, medians.ndEbitda, true),
    },
  ];

  const billSplit: BillSplitRow[] = CATEGORIES.map((category) => {
    const e = company.emissions[category];
    const mac = model.config.mac[category];
    return { category, label: CATEGORY_LABEL[category], usd: e === null ? null : e * Math.max(mac, 0) };
  });

  const peers: CompanyPeer[] = sectorScores
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((s) => ({ ticker: s.ticker, score: s.score, isSelf: s.ticker === ticker }));

  const loWeight = model.result.longOnly.weights.get(ticker);
  const active = loWeight?.active ?? 0;
  const { position, stance } = positionAndStance(active);
  const reason = reasonSentence(score, position, medians.tbr);

  const pick = model.stress?.picks.find((p) => p.ticker === ticker);
  const badges: CompanyBadges = {
    robust: !model.stress || !pick ? "no-position" : pick.robust ? "holds" : "does-not-hold",
    data: score.flags.some((f) => f.includes("imputed") || f.includes("fallback")) ? "estimated" : "reported",
  };

  const takeaways: string[] = [
    `${ticker}'s cleanup cost is ${formatYears(score.tbr)}, ${
      score.tbr > medians.tbr ? "above" : score.tbr < medians.tbr ? "below" : "at"
    } the ${score.sector} median of ${formatYears(medians.tbr)}.`,
    `Fossil revenue at risk is ${formatPercent(score.de)} versus a sector median of ${formatPercent(medians.de)}.`,
    `Fund stance: ${stance}.`,
  ];

  return { header, tiles, billSplit, peers, reason, stance, badges, takeaways };
}
