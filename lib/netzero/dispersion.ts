import { groupBySector, type CompanyScore } from "./scenario";
import { iqr, median } from "./stats";

export interface SectorDispersion {
  sector: string;
  n: number;
  tbrIqr: number;
  scoreIqr: number;
  medianTbr: number;
  medianScore: number;
  tradeable: boolean;
}

/** PDF §8: tradeable if TBR IQR > threshold OR score IQR > threshold; ordered by score IQR. */
export function sectorDispersion(
  scores: Iterable<CompanyScore>,
  thresholds: { tbrIqrThreshold: number; scoreIqrThreshold: number },
): SectorDispersion[] {
  const out: SectorDispersion[] = [];
  for (const [sector, members] of groupBySector(scores)) {
    const tbrs = members.map((m) => m.tbr);
    const values = members.map((m) => m.score);
    const tbrIqr = iqr(tbrs);
    const scoreIqr = iqr(values);
    out.push({
      sector,
      n: members.length,
      tbrIqr,
      scoreIqr,
      medianTbr: median(tbrs),
      medianScore: median(values),
      tradeable: tbrIqr > thresholds.tbrIqrThreshold || scoreIqr > thresholds.scoreIqrThreshold,
    });
  }
  return out.sort((a, b) => b.scoreIqr - a.scoreIqr);
}
