import { spearman } from "./stats";
import type { ValidationRow } from "./types";

export interface ValidationSummary {
  /** Rows with both a 2019 TBR and an intensity change. */
  n: number;
  /** Spearman rank correlation of tbr2019 vs intensityChange; null below 3 usable rows. */
  spearman: number | null;
  bySector: Record<string, number>;
}

/** True once at least two distinct values are present; a constant column has no rank correlation. */
function hasVariance(values: number[]): boolean {
  return values.some((v) => v !== values[0]);
}

/** PDF §11 check: did low-burden companies decarbonise faster? Expect a positive correlation if so. */
export function validationSummary(rows: ValidationRow[]): ValidationSummary {
  const usable = rows.filter((r) => r.tbr2019 !== null && r.intensityChange !== null);
  const bySector: Record<string, number> = {};
  for (const r of usable) bySector[r.sector] = (bySector[r.sector] ?? 0) + 1;
  const tbrs = usable.map((r) => r.tbr2019 as number);
  const changes = usable.map((r) => r.intensityChange as number);
  return {
    n: usable.length,
    spearman: usable.length >= 3 && hasVariance(tbrs) && hasVariance(changes) ? spearman(tbrs, changes) : null,
    bySector,
  };
}
