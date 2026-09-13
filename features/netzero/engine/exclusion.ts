import { CATEGORIES, type CompanyInput } from "./types";

export function totalEmissions(c: CompanyInput): number | null {
  let total = 0;
  let any = false;
  for (const cat of CATEGORIES) {
    const e = c.emissions[cat];
    if (e === null) continue;
    any = true;
    total += e;
  }
  return any ? total : null;
}

export interface ExclusionBook {
  weights: Map<string, number>;
  excluded: string[];
  sectorWeights: Map<string, number>;
}

/** PDF §9.2 naive comparison: drop the index's highest-emitting decile (absolute Scope 1+2), re-weight by float cap. */
export function buildExclusion(companies: CompanyInput[]): ExclusionBook {
  const investable = companies.filter((c) => c.floatCap !== null && c.floatCap > 0);
  const decile = Math.ceil(investable.length / 10);
  const excluded = investable
    .filter((c) => totalEmissions(c) !== null)
    .sort((a, b) => (totalEmissions(b) as number) - (totalEmissions(a) as number))
    .slice(0, decile)
    .map((c) => c.ticker);
  const excludedSet = new Set(excluded);
  const kept = investable.filter((c) => !excludedSet.has(c.ticker));
  const total = kept.reduce((a, c) => a + (c.floatCap as number), 0);

  const weights = new Map(kept.map((c) => [c.ticker, (c.floatCap as number) / total]));
  const sectorWeights = new Map<string, number>();
  for (const c of kept) sectorWeights.set(c.sector, (sectorWeights.get(c.sector) ?? 0) + weights.get(c.ticker)!);
  return { weights, excluded, sectorWeights };
}
