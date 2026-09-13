import type { AxisKey } from "./variables";

/** One sp500_esg_scores row as the leaderboard reads it. */
export type ScoreRow = {
  ticker: string;
  company_name: string;
  sector: string;
  score: number;
  rank: number;
  sector_rank: number;
  weight_env_intensity: number;
  weight_esg_risk: number;
  weight_controversy: number;
  weight_asset_turnover: number;
  weight_profit_margin: number;
  weight_fcf_margin: number;
  weight_leverage: number;
  pillar_environmental_score: number;
  pillar_social_score: number;
  pillar_financial_score: number;
};

export type CompanyDetailRow = {
  ticker: string;
  company_name: string;
  sector: string;
  score: number;
  rank: number;
  sector_rank: number;
  percentile_index: number;
  percentile_sector: number;
  pillar_environmental_score: number;
  pillar_social_score: number;
  pillar_financial_score: number;
} & {
  [K in AxisKey as `weight_${K}`]: number;
} & {
  [K in AxisKey as `contrib_${K}`]: number;
} & {
  [K in AxisKey as `${K}_raw`]: number;
};

export type CorrelationRow = { variable_a: string; variable_b: string; r: number };

/** Full sp500_esg_scores row for one company, including d_plus (distance to the ideal). */
export type SustainabilityResult = CompanyDetailRow & { d_plus: number };

export type SustainabilityRankingRow = ScoreRow;
