import { sectorTbr } from "./bill";
import { capWeights, entropyWeights } from "./entropy";
import { topsis } from "./topsis";
import { normaliseSector, type RawRow } from "./transform";
import type { CompanyInput, ScenarioConfig, Variable } from "./types";

export interface CompanyScore {
  ticker: string;
  sector: string;
  score: number;
  dPlus: number;
  /** 1 = best in sector. */
  rank: number;
  sectorSize: number;
  /** "Top X%" of the sector. */
  topPercent: number;
  bill: number | null;
  tbr: number;
  de: number | null;
  ben: number | null;
  ndEbitda: number | null;
  fcfMargin: number | null;
  x: Record<Variable, number>;
  shares: Record<Variable, number>;
  flags: string[];
}

export interface SectorModel {
  sector: string;
  variables: readonly Variable[];
  tickers: string[];
  /** matrix[i][j] = normalised value of tickers[i] on variables[j]. */
  matrix: number[][];
  entropy: number[];
  weights: number[];
  weightEvents: string[];
}

type BaseRow = Omit<CompanyScore, "score" | "dPlus" | "rank" | "topPercent" | "shares">;

export interface PreparedScenario {
  config: ScenarioConfig;
  sectors: SectorModel[];
  rows: Map<string, BaseRow>;
}

export interface ScenarioResult {
  scores: Map<string, CompanyScore>;
  sectors: SectorModel[];
}

export function ratios(
  c: CompanyInput,
): { ndEbitda: number | null; fcfMargin: number | null; negativeEbitdaWithDebt: boolean } {
  const ndEbitda = c.netDebt !== null && c.ebitdaTtm !== null && c.ebitdaTtm > 0 ? c.netDebt / c.ebitdaTtm : null;
  const fcfMargin = c.fcfTtm !== null && c.revenueTtm !== null && c.revenueTtm > 0 ? c.fcfTtm / c.revenueTtm : null;
  const negativeEbitdaWithDebt = c.ebitdaTtm !== null && c.ebitdaTtm <= 0 && c.netDebt !== null && c.netDebt > 0;
  return { ndEbitda, fcfMargin, negativeEbitdaWithDebt };
}

export function groupBySector<T extends { sector: string }>(items: Iterable<T>): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const list = out.get(item.sector) ?? [];
    list.push(item);
    out.set(item.sector, list);
  }
  return out;
}

/** Everything that does not depend on the weights: TBR, transform, entropy (PDF §4, §7). */
export function prepareScenario(companies: CompanyInput[], config: ScenarioConfig): PreparedScenario {
  const { options } = config;
  const sectors: SectorModel[] = [];
  const rows = new Map<string, BaseRow>();

  for (const [sector, members] of groupBySector(companies)) {
    const tbr = sectorTbr(members, config.mac);
    const raw: RawRow[] = members.map((c) => ({ ticker: c.ticker, tbr: tbr.get(c.ticker)!.tbr, de: c.de, ben: c.ben, ...ratios(c) }));
    const normalised = normaliseSector(raw, options);
    const matrix = normalised.map((r) => options.variables.map((v) => r.x[v]));
    const columns = options.variables.map((_, j) => matrix.map((row) => row[j]));
    const entropy = entropyWeights(columns);
    const capped = capWeights(entropy, options.weightCap, options.variables);

    sectors.push({
      sector,
      variables: options.variables,
      tickers: members.map((c) => c.ticker),
      matrix,
      entropy,
      weights: capped.weights,
      weightEvents: capped.events,
    });

    members.forEach((c, i) => {
      rows.set(c.ticker, {
        ticker: c.ticker,
        sector,
        sectorSize: members.length,
        bill: tbr.get(c.ticker)!.bill,
        tbr: raw[i].tbr,
        de: c.de,
        ben: c.ben,
        ndEbitda: raw[i].ndEbitda,
        fcfMargin: raw[i].fcfMargin,
        x: normalised[i].x,
        flags: [...c.flags, ...tbr.get(c.ticker)!.flags, ...normalised[i].flags],
      });
    });
  }
  return { config, sectors, rows };
}

/** TOPSIS + ranking per sector. `weightOverride` replaces sector weights (used by the §11 perturbation). */
export function scoreScenario(prepared: PreparedScenario, weightOverride?: Map<string, number[]>): ScenarioResult {
  const scores = new Map<string, CompanyScore>();
  for (const model of prepared.sectors) {
    const weights = weightOverride?.get(model.sector) ?? model.weights;
    const results = topsis(model.matrix, weights);
    const order = results
      .map((r, i) => ({ r, i }))
      .sort((a, b) => b.r.score - a.r.score || a.r.dPlus - b.r.dPlus);
    order.forEach(({ r, i }, position) => {
      const base = prepared.rows.get(model.tickers[i])!;
      const rank = position + 1;
      scores.set(base.ticker, {
        ...base,
        score: r.score,
        dPlus: r.dPlus,
        rank,
        topPercent: Math.ceil((rank / model.tickers.length) * 100),
        shares: Object.fromEntries(model.variables.map((v, j) => [v, r.shares[j]])) as Record<Variable, number>,
      });
    });
  }
  return { scores, sectors: prepared.sectors };
}

export function runScenario(companies: CompanyInput[], config: ScenarioConfig): ScenarioResult {
  return scoreScenario(prepareScenario(companies, config));
}
