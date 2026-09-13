import { createPublicClient } from "@/lib/supabase/public";

import type { CorrelationRow, SustainabilityRankingRow, SustainabilityResult } from "./types";

export type { CorrelationRow, SustainabilityRankingRow, SustainabilityResult } from "./types";

/** One company's full score row, or null when the ticker is not in the index. */
export async function getSustainabilityScore(ticker: string): Promise<SustainabilityResult | null> {
  const { data, error } = await createPublicClient()
    .from("sp500_esg_scores")
    .select("*")
    .eq("ticker", ticker.trim().toUpperCase())
    .maybeSingle();
  if (error) throw new Error(`sp500_esg_scores: ${error.message}`);
  return data as SustainabilityResult | null;
}

/** Every company, best score first. */
export async function getSustainabilityRanking(): Promise<SustainabilityRankingRow[]> {
  const { data, error } = await createPublicClient()
    .from("sp500_esg_scores")
    .select("*")
    .order("rank", { ascending: true });
  if (error) throw new Error(`sp500_esg_scores: ${error.message}`);
  return (data ?? []) as SustainabilityRankingRow[];
}

/** Pairwise correlations between the seven scoring variables. */
export async function getSustainabilityCorrelation(): Promise<CorrelationRow[]> {
  const { data, error } = await createPublicClient().from("sp500_esg_correlation").select("*");
  if (error) throw new Error(`sp500_esg_correlation: ${error.message}`);
  return (data ?? []) as CorrelationRow[];
}
