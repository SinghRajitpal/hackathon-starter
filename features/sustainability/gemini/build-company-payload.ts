import { AXES } from "@/features/sustainability/variables";
import type { CompanyDetailRow } from "@/features/sustainability/components/company-detail";

// The row shape the API route actually reads from Supabase (select("*")
// on sp500_esg_scores) -- a superset of CompanyDetailRow that also
// carries d_plus, the model's own "distance to the ideal" (blueprint
// section 8). Extending rather than duplicating the existing type.
export type ScoreRowWithDistance = CompanyDetailRow & { d_plus: number };

// Builds the dynamic, company-specific JSON sent to Gemini alongside
// the static GEMINI_SUSTAINABILITY_SYSTEM_PROMPT. Pure function, no I/O
// -- reuses the row already fetched from our existing sp500_esg_scores
// table and the existing AXES metadata (lib/variables.ts) instead of
// inventing a parallel data representation. Works identically for every
// company; nothing here is ticker-specific beyond the `row` argument.
export function buildCompanyPayload(row: ScoreRowWithDistance, totalCompanies: number) {
  const distanceToIdealDecomposition = Object.fromEntries(
    AXES.map((axis) => [axis.label, Number(row[`contrib_${axis.key}`].toFixed(4))]),
  );

  const variables = Object.fromEntries(
    AXES.map((axis) => [
      axis.label,
      {
        value: row[`${axis.key}_raw`],
        unit: axis.unit,
        direction: axis.direction,
        source: axis.source,
        weight: Number(row[`weight_${axis.key}`].toFixed(4)),
        contribution_to_distance: Number(row[`contrib_${axis.key}`].toFixed(4)),
      },
    ]),
  );

  return {
    company: row.company_name,
    ticker: row.ticker,
    sector: row.sector,
    rank: row.rank,
    total_companies: totalCompanies,
    overall_score: row.score,
    environmental_score: row.pillar_environmental_score,
    social_score: row.pillar_social_score,
    finance_operations_score: row.pillar_financial_score,
    distance_to_ideal: Number(row.d_plus.toFixed(4)),
    distance_to_ideal_decomposition: distanceToIdealDecomposition,
    variables,
  };
}

export type CompanyPayload = ReturnType<typeof buildCompanyPayload>;
