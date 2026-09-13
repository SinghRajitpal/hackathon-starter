import { SECTOR_VERDICT_TEXT } from "@/features/netzero/engine/dashboard/labels";
import { buildMarketView } from "@/features/netzero/engine/dashboard/market";
import { buildPortfolioDashboard, type OverUnderRow } from "@/features/netzero/engine/dashboard/portfolio";
import type { DashboardModel, TrailTolerance } from "@/features/netzero/engine/dashboard/types";
import { median } from "@/features/netzero/engine/stats";
import type { ScenarioData } from "@/features/netzero/engine/types";

import type { VerdictBand } from "./types";
import { computeVerdict, VERDICT_RULE_TEXT, type VerdictReasonCode } from "./verdict";

/**
 * Evidence packets: the closed set of facts Gemini may narrate. Every value is read from the engine's
 * existing view-models; nothing here scores, ranks or allocates. Fractions become percentages, money
 * becomes USD millions, floats are rounded to two decimals, and missing values stay as null.
 */

export const PACKET_SCHEMA_VERSION = 1;
/** Positions listed per side in the portfolio packet. */
export const PORTFOLIO_TOP_N = 5;

type Num = number | null;

interface PacketBase {
  schema_version: typeof PACKET_SCHEMA_VERSION;
  generated_at: string;
}

export interface CompanyPacket extends PacketBase {
  scope: "company";
  ticker: string;
  company_name: string;
  sector: string;
  cleanup_cost_usd_m: Num;
  transition_bill_to_ebitda_years: Num;
  revenue_at_risk_pct: Num;
  revenue_upside_pct: Num;
  fossil_revenue_share_pct: Num;
  green_revenue_share_pct: Num;
  composite_score: Num;
  rank_in_sector: number;
  sector_size: number;
  top_percent_in_sector: number;
  sector_median_transition_bill_to_ebitda_years: Num;
  sector_median_revenue_at_risk_pct: Num;
  sector_p75_revenue_at_risk_pct: Num;
  verdict_band: VerdictBand;
  verdict_reason_code: VerdictReasonCode;
  verdict_rule: string;
}

export interface SectorPacket extends PacketBase {
  scope: "sector";
  sector: string;
  company_count: number;
  cleanup_cost_usd_m: Num;
  cleanup_cost_years_of_sector_ebitda: Num;
  median_transition_bill_to_ebitda_years: Num;
  winner_loser_gap_years: Num;
  fossil_revenue_share_pct: Num;
  green_revenue_share_pct: Num;
  sector_verdict: string;
  pickable: boolean;
  leaderboard_rank: number;
  leaderboard_size: number;
  best_ticker: string | null;
  best_company_name: string | null;
  best_composite_score: Num;
  best_transition_bill_to_ebitda_years: Num;
  best_revenue_at_risk_pct: Num;
  worst_ticker: string | null;
  worst_company_name: string | null;
  worst_composite_score: Num;
  worst_transition_bill_to_ebitda_years: Num;
  worst_revenue_at_risk_pct: Num;
}

export interface LeaderboardRow {
  sector: string;
  company_count: number;
  cleanup_cost_usd_m: Num;
  cleanup_cost_years_of_sector_ebitda: Num;
  fossil_revenue_share_pct: Num;
  green_revenue_share_pct: Num;
  winner_loser_gap_years: Num;
  sector_verdict: string;
  pickable: boolean;
}

export interface MarketPacket extends PacketBase {
  scope: "market";
  sectors_covered: number;
  companies_covered: number;
  pickable_sector_count: number;
  leaderboard: LeaderboardRow[];
}

export interface PositionRow {
  ticker: string;
  sector: string;
  active_weight_pp: Num;
  portfolio_weight_pct: Num;
  composite_score: Num;
  transition_bill_to_ebitda_years: Num;
  revenue_at_risk_pct: Num;
  green_revenue_share_pct: Num;
}

export interface ShortRow {
  ticker: string;
  sector: string;
  short_weight_pct: Num;
  composite_score: Num;
  transition_bill_to_ebitda_years: Num;
  revenue_at_risk_pct: Num;
  green_revenue_share_pct: Num;
}

export interface PortfolioPacket extends PacketBase {
  scope: "portfolio";
  risk_appetite_band: string;
  preset: string;
  shorting_allowed: boolean;
  long_short_book: boolean;
  robust_picks_only: boolean;
  active_limit_pp: Num;
  top_longs: PositionRow[];
  top_underweights: PositionRow[];
  top_shorts: ShortRow[] | null;
  gross_exposure_pct: Num;
  net_exposure_pct: Num;
  sectors_traded: number;
}

export type Packet = CompanyPacket | SectorPacket | MarketPacket | PortfolioPacket;

export const RISK_APPETITE_BAND: Record<TrailTolerance, string> = {
  low: "under 1%",
  medium: "up to 3%",
  high: "more than 3%",
};

function round2(value: number | null | undefined): Num {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const r = Math.round(value * 100) / 100;
  return r === 0 ? 0 : r;
}

const pct = (fraction: number | null | undefined): Num => round2(fraction === null || fraction === undefined ? null : fraction * 100);
const usdM = (usd: number | null | undefined): Num => round2(usd === null || usd === undefined ? null : usd / 1e6);

function base(now: Date): PacketBase {
  return { schema_version: PACKET_SCHEMA_VERSION, generated_at: now.toISOString() };
}

export function buildCompanyPacket(data: ScenarioData, model: DashboardModel, ticker: string, now: Date): CompanyPacket | null {
  const score = model.result.scores.get(ticker);
  const company = data.companies.find((c) => c.ticker === ticker);
  if (!score || !company) return null;

  const sectorScores = [...model.result.scores.values()].filter((s) => s.sector === score.sector);
  const verdict = computeVerdict(score, sectorScores);

  return {
    ...base(now),
    scope: "company",
    ticker: score.ticker,
    company_name: company.companyName,
    sector: score.sector,
    cleanup_cost_usd_m: usdM(score.bill),
    transition_bill_to_ebitda_years: round2(score.tbr),
    revenue_at_risk_pct: pct(score.de),
    revenue_upside_pct: pct(score.ben),
    fossil_revenue_share_pct: pct(score.de),
    green_revenue_share_pct: pct(score.ben),
    composite_score: round2(score.score),
    rank_in_sector: score.rank,
    sector_size: score.sectorSize,
    top_percent_in_sector: score.topPercent,
    sector_median_transition_bill_to_ebitda_years: round2(median(sectorScores.map((s) => s.tbr))),
    sector_median_revenue_at_risk_pct: pct(verdict.sectorMedianRevenueAtRisk),
    sector_p75_revenue_at_risk_pct: pct(verdict.sectorP75RevenueAtRisk),
    verdict_band: verdict.band,
    verdict_reason_code: verdict.reasonCode,
    verdict_rule: VERDICT_RULE_TEXT,
  };
}

export function buildSectorPacket(data: ScenarioData, model: DashboardModel, sector: string, now: Date): SectorPacket | null {
  const market = buildMarketView(data, model);
  const index = market.rows.findIndex((r) => r.sector === sector);
  if (index < 0) return null;
  const row = market.rows[index];
  const dispersion = model.result.dispersion.find((d) => d.sector === sector);
  const ranked = [...model.result.scores.values()].filter((s) => s.sector === sector).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const name = (ticker: string | undefined) => data.companies.find((c) => c.ticker === ticker)?.companyName ?? null;

  return {
    ...base(now),
    scope: "sector",
    sector,
    company_count: row.n,
    cleanup_cost_usd_m: usdM(row.billUsd),
    cleanup_cost_years_of_sector_ebitda: round2(row.cleanupYears),
    median_transition_bill_to_ebitda_years: round2(dispersion?.medianTbr),
    winner_loser_gap_years: round2(row.gapYears),
    fossil_revenue_share_pct: pct(row.fossilShare),
    green_revenue_share_pct: pct(row.greenShare),
    sector_verdict: SECTOR_VERDICT_TEXT[row.verdict],
    pickable: row.verdict === "pick-winners",
    leaderboard_rank: index + 1,
    leaderboard_size: market.rows.length,
    best_ticker: best?.ticker ?? null,
    best_company_name: name(best?.ticker),
    best_composite_score: round2(best?.score),
    best_transition_bill_to_ebitda_years: round2(best?.tbr),
    best_revenue_at_risk_pct: pct(best?.de),
    worst_ticker: worst?.ticker ?? null,
    worst_company_name: name(worst?.ticker),
    worst_composite_score: round2(worst?.score),
    worst_transition_bill_to_ebitda_years: round2(worst?.tbr),
    worst_revenue_at_risk_pct: pct(worst?.de),
  };
}

export function buildMarketPacket(data: ScenarioData, model: DashboardModel, now: Date): MarketPacket {
  const { rows } = buildMarketView(data, model);
  return {
    ...base(now),
    scope: "market",
    sectors_covered: rows.length,
    companies_covered: data.companies.length,
    pickable_sector_count: rows.filter((r) => r.verdict === "pick-winners").length,
    leaderboard: rows.map((r) => ({
      sector: r.sector,
      company_count: r.n,
      cleanup_cost_usd_m: usdM(r.billUsd),
      cleanup_cost_years_of_sector_ebitda: round2(r.cleanupYears),
      fossil_revenue_share_pct: pct(r.fossilShare),
      green_revenue_share_pct: pct(r.greenShare),
      winner_loser_gap_years: round2(r.gapYears),
      sector_verdict: SECTOR_VERDICT_TEXT[r.verdict],
      pickable: r.verdict === "pick-winners",
    })),
  };
}

export function buildPortfolioPacket(data: ScenarioData, model: DashboardModel, now: Date): PortfolioPacket {
  const dashboard = buildPortfolioDashboard(data, model);
  const { scores, longOnly, longShort } = model.result;

  const positionRow = (r: OverUnderRow): PositionRow => {
    const s = scores.get(r.ticker);
    return {
      ticker: r.ticker,
      sector: r.sector,
      active_weight_pp: round2(r.activePp),
      portfolio_weight_pct: pct(longOnly.weights.get(r.ticker)?.portfolio),
      composite_score: round2(s?.score),
      transition_bill_to_ebitda_years: round2(s?.tbr),
      revenue_at_risk_pct: pct(s?.de),
      green_revenue_share_pct: pct(s?.ben),
    };
  };

  const shorts = model.preset.longShort
    ? longShort.positions
        .filter((p) => p.side === "short")
        .sort((a, b) => b.weight - a.weight)
        .slice(0, PORTFOLIO_TOP_N)
        .map((p): ShortRow => {
          const s = scores.get(p.ticker);
          return {
            ticker: p.ticker,
            sector: p.sector,
            short_weight_pct: pct(p.weight),
            composite_score: round2(s?.score),
            transition_bill_to_ebitda_years: round2(s?.tbr),
            revenue_at_risk_pct: pct(s?.de),
            green_revenue_share_pct: pct(s?.ben),
          };
        })
    : null;

  return {
    ...base(now),
    scope: "portfolio",
    risk_appetite_band: RISK_APPETITE_BAND[model.answers.trail],
    preset: model.preset.label,
    shorting_allowed: model.answers.allowShorts,
    long_short_book: model.preset.longShort,
    robust_picks_only: model.preset.robustOnly,
    active_limit_pp: round2(model.preset.activeLimit * 100),
    top_longs: dashboard.overweights.slice(0, PORTFOLIO_TOP_N).map(positionRow),
    top_underweights: dashboard.underweights.slice(0, PORTFOLIO_TOP_N).map(positionRow),
    top_shorts: shorts,
    gross_exposure_pct: model.preset.longShort ? pct(longShort.gross) : null,
    net_exposure_pct: model.preset.longShort ? pct(longShort.net) : null,
    sectors_traded: dashboard.sectorBets.length,
  };
}
