import type { SectorDispersion } from "./dispersion";
import { reasonSentence, topDrivers, type PositionLabel } from "./explain";
import type { LongOnlyBook } from "./longOnly";
import type { LongShortBook } from "./longShort";
import type { CompanyScore } from "./scenario";
import type { CompanyInput, Variable } from "./types";

export interface AllocationRow {
  ticker: string;
  companyName: string;
  sector: string;
  position: PositionLabel;
  /** Fraction of capital; negative for shorts. */
  weight: number;
  benchmarkWeight: number | null;
  activeWeight: number | null;
  /** Negative for shorts. */
  dollars: number;
  shares: number | null;
  price: number | null;
  score: number | null;
  drivers: Variable[];
  reason: string;
}

function context(companies: CompanyInput[], dispersion: SectorDispersion[]) {
  return {
    company: new Map(companies.map((c) => [c.ticker, c])),
    medianTbr: new Map(dispersion.map((d) => [d.sector, d.medianTbr])),
  };
}

function row(
  ticker: string,
  position: PositionLabel,
  weight: number,
  benchmarkWeight: number | null,
  capital: number,
  scores: Map<string, CompanyScore>,
  ctx: ReturnType<typeof context>,
): AllocationRow {
  const c = ctx.company.get(ticker)!;
  const s = scores.get(ticker);
  const dollars = weight * capital;
  return {
    ticker,
    companyName: c.companyName,
    sector: c.sector,
    position,
    weight,
    benchmarkWeight,
    activeWeight: benchmarkWeight === null ? null : weight - benchmarkWeight,
    dollars,
    shares: c.price && c.price > 0 ? Math.floor(Math.abs(dollars) / c.price) : null,
    price: c.price,
    score: s?.score ?? null,
    drivers: s ? topDrivers(s.shares) : [],
    reason: s ? reasonSentence(s, position, ctx.medianTbr.get(c.sector) ?? 0) : "Not scored in the scenario universe.",
  };
}

/** PDF §10 position list for the long/short book. */
export function allocateLongShort(
  book: LongShortBook,
  scores: Map<string, CompanyScore>,
  companies: CompanyInput[],
  dispersion: SectorDispersion[],
  capital: number,
): AllocationRow[] {
  const ctx = context(companies, dispersion);
  return book.positions
    .map((p) => row(p.ticker, p.side, p.side === "long" ? p.weight : -p.weight, null, capital, scores, ctx))
    .sort((a, b) => a.sector.localeCompare(b.sector) || b.weight - a.weight);
}

/** PDF §10 full weight vector for the long-only tilt. */
export function allocateLongOnly(
  book: LongOnlyBook,
  scores: Map<string, CompanyScore>,
  companies: CompanyInput[],
  dispersion: SectorDispersion[],
  capital: number,
): AllocationRow[] {
  const ctx = context(companies, dispersion);
  return [...book.weights.values()]
    .map((w) => {
      const position: PositionLabel = w.active > 1e-9 ? "overweight" : w.active < -1e-9 ? "underweight" : "benchmark";
      return row(w.ticker, position, w.portfolio, w.benchmark, capital, scores, ctx);
    })
    .sort((a, b) => a.sector.localeCompare(b.sector) || (b.activeWeight ?? 0) - (a.activeWeight ?? 0));
}

const CSV_COLUMNS: (keyof AllocationRow)[] = [
  "ticker", "companyName", "sector", "position", "weight", "benchmarkWeight", "activeWeight",
  "dollars", "shares", "price", "score", "drivers", "reason",
];

/** Columns that can carry user- or vendor-supplied strings; only these get the formula-injection guard. */
const TEXT_COLUMNS = new Set<keyof AllocationRow>(["ticker", "sector", "companyName", "reason", "drivers"]);

/** OWASP CSV injection: a leading =, +, -, @, tab or carriage return can launch a formula in a spreadsheet. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown, guardFormula: boolean): string {
  let text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join("|") : String(value);
  if (guardFormula && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /["\r\n,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: AllocationRow[]): string {
  return [
    CSV_COLUMNS.join(","),
    ...rows.map((r) => CSV_COLUMNS.map((k) => csvCell(r[k], TEXT_COLUMNS.has(k))).join(",")),
  ].join("\n");
}
