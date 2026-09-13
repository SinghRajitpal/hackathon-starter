export type ExplainScope = "company" | "sector" | "market" | "portfolio";
export const EXPLAIN_SCOPES: readonly ExplainScope[] = ["company", "sector", "market", "portfolio"];

export type VerdictBand = "BUY" | "HOLD" | "SELL";

export interface CompanyExplanation {
  verdict: VerdictBand;
  verdict_line: string;
  key_drivers: string[];
  rationale: string;
  caveat: string;
}

export interface SectorExplanation {
  headline: string;
  takeaways: string[];
  pickability: string;
}

export interface MarketExplanation {
  headline: string;
  heaviest_hit: string[];
  least_affected: string[];
  where_to_pick: string;
}

export interface PortfolioExplanation {
  headline: string;
  long_thesis: string;
  short_thesis: string;
  risk_note: string;
}

export interface ExplanationByScope {
  company: CompanyExplanation;
  sector: SectorExplanation;
  market: MarketExplanation;
  portfolio: PortfolioExplanation;
}

export type ExplanationPayload = ExplanationByScope[ExplainScope];

export type ExplanationSource = "cache" | "gemini" | "fallback";

export type FallbackReason = "no-key" | "rate-limited" | "timeout" | "gemini-error" | "invalid-output" | "ungrounded" | "no-packet";

/** What POST /api/explain returns. Never carries the API key or raw Gemini errors. */
export interface ExplainResponse {
  scope: ExplainScope;
  key: string;
  source: ExplanationSource;
  fallbackReason: FallbackReason | null;
  model: string | null;
  explanation: ExplanationPayload;
}
