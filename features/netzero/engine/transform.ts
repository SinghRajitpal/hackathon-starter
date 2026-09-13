import { median, quantile } from "./stats";
import type { EngineOptions, Variable } from "./types";

export interface RawRow {
  ticker: string;
  tbr: number;
  de: number | null;
  ben: number | null;
  ndEbitda: number | null;
  fcfMargin: number | null;
  /** EBITDA <= 0 with net debt > 0 (PDF gap ruling): leverage scores as the sector's worst, not imputed. */
  negativeEbitdaWithDebt?: boolean;
}

export interface NormalisedRow {
  ticker: string;
  x: Record<Variable, number>;
  flags: string[];
}

/** PDF §3 table. Leverage is already turned into distance-from-target, so it is a cost. */
export const DIRECTION: Record<Variable, "cost" | "benefit"> = {
  tbr: "cost",
  de: "cost",
  ben: "benefit",
  leverage: "cost",
  fcfMargin: "benefit",
};

function fillWithMedian(values: (number | null)[]) {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const m = present.length ? median(present) : 0;
  const imputed = values.map((v) => v === null || !Number.isFinite(v));
  return { filled: values.map((v, i) => (imputed[i] ? m : (v as number))), imputed, median: m };
}

/** Min-max within the sector (PDF §7). [gap] A constant column maps to 1 for everyone. */
function minMax(values: number[], direction: "cost" | "benefit"): number[] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi - lo < 1e-12) return values.map(() => 1);
  return values.map((v) => (direction === "benefit" ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)));
}

export function normaliseSector(rows: RawRow[], options: EngineOptions): NormalisedRow[] {
  const flags = rows.map(() => [] as string[]);
  const columns = new Map<Variable, number[]>();

  for (const variable of options.variables) {
    let values: number[];
    if (variable === "tbr") {
      values = rows.map((r) => r.tbr);
      if (options.winsorise) {
        const ceiling = quantile(values, 0.975);
        values = values.map((v) => Math.min(v, ceiling));
      }
      if (options.logTbr) values = values.map((v) => Math.log1p(Math.max(v, 0)));
    } else if (variable === "de" || variable === "ben") {
      values = rows.map((r, i) => {
        const v = r[variable];
        if (v === null) {
          flags[i].push(`${variable}-unclassified-zero`);
          return 0;
        }
        return v;
      });
    } else if (variable === "leverage") {
      const negativeWithDebt = rows.map((r) => r.negativeEbitdaWithDebt === true);
      const normalRows = rows.map((r, i) => (negativeWithDebt[i] ? null : r.ndEbitda));
      const { filled, imputed, median: m } = fillWithMedian(normalRows);
      imputed.forEach((isImputed, i) => {
        if (negativeWithDebt[i]) flags[i].push("leverage-negative-ebitda");
        else if (isImputed) flags[i].push("leverage-imputed");
      });
      const target = options.leverageTarget ?? m;
      const distances = filled.map((v) => Math.abs(v - target));
      const normalDistances = distances.filter((_, i) => !negativeWithDebt[i]);
      const worst = normalDistances.length ? Math.max(...normalDistances) : distances[0] ?? 0;
      values = distances.map((d, i) => (negativeWithDebt[i] ? worst : d));
    } else {
      const { filled, imputed } = fillWithMedian(rows.map((r) => r.fcfMargin));
      imputed.forEach((isImputed, i) => isImputed && flags[i].push("fcf-margin-imputed"));
      values = filled;
    }
    columns.set(variable, minMax(values, DIRECTION[variable]));
  }

  return rows.map((r, i) => ({
    ticker: r.ticker,
    x: Object.fromEntries(options.variables.map((v) => [v, columns.get(v)![i]])) as Record<Variable, number>,
    flags: flags[i],
  }));
}
