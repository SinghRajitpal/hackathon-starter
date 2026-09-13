import type { CompanyScore } from "./scenario";
import { VARIABLE_LABEL, type Variable } from "./types";

export type PositionLabel = "long" | "short" | "overweight" | "underweight" | "benchmark" | "untraded";

/** Variables owning the largest share of the distance to the sector ideal (PDF §7). */
export function topDrivers(shares: Partial<Record<Variable, number>>, k = 2): Variable[] {
  return (Object.entries(shares) as [Variable, number][])
    .filter(([, share]) => share > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([variable]) => variable);
}

const percent = (v: number | null) => (v === null ? "n/a" : `${Math.round(v * 100)}%`);
const years = (v: number) => `${v.toFixed(2)} years`;

/** D17: deterministic sentence in the §7/§12 shape. No LLM. */
export function reasonSentence(s: CompanyScore, position: PositionLabel, sectorMedianTbr: number): string {
  const lead = position.charAt(0).toUpperCase() + position.slice(1);
  const drivers = topDrivers(s.shares).map((v) => VARIABLE_LABEL[v]);
  const leverage = s.ndEbitda === null ? "n/a" : `${s.ndEbitda.toFixed(1)}x`;
  const driverText = drivers.length ? `; largest gaps to the sector ideal: ${drivers.join(" and ")}` : "";
  return `${lead}: burden ${years(s.tbr)} of earnings (sector median ${years(sectorMedianTbr)}), fossil revenue ${percent(s.de)}, beneficiary revenue ${percent(s.ben)}, net debt/EBITDA ${leverage}${driverText}.`;
}
