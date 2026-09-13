import type { SectorDispersion } from "./dispersion";
import { groupBySector, type CompanyScore } from "./scenario";
import { median } from "./stats";
import { waterfill } from "./waterfill";

/** PDF §9.1 limits, as fractions of capital. Gross 200% of capital. */
export const LS_LIMITS = { gross: 2, nameCapOfGross: 0.03, sectorCapOfGross: 0.2 };

export interface LsPosition {
  ticker: string;
  sector: string;
  side: "long" | "short";
  /** Fraction of capital, always positive. */
  weight: number;
}

export interface LongShortBook {
  positions: LsPosition[];
  gross: number;
  net: number;
  cash: number;
  sectorGross: Map<string, number>;
  events: string[];
}

/** Top/bottom quintile, floor 2, cap 5 (PDF §9.1). [gap] Quintile rounds up; tiny sectors split in half. */
export function namesPerSide(n: number): number {
  if (n < 4) return Math.floor(n / 2);
  return Math.min(5, Math.max(2, Math.ceil(n / 5)));
}

export function selectSides(sectorScores: CompanyScore[]) {
  const sorted = [...sectorScores].sort((a, b) => b.score - a.score || a.dPlus - b.dPlus);
  const med = median(sorted.map((s) => s.score));
  const k = namesPerSide(sorted.length);
  return {
    longs: sorted.slice(0, k).filter((s) => s.score > med),
    shorts: sorted.slice(sorted.length - k).filter((s) => s.score < med),
    median: med,
  };
}

/** size_i = |score_i − median| / Σ |score_k − median| within the leg. */
export function legShares(leg: CompanyScore[], med: number): Map<string, number> {
  const distances = leg.map((s) => Math.abs(s.score - med));
  const total = distances.reduce((a, b) => a + b, 0);
  return new Map(leg.map((s, i) => [s.ticker, total > 0 ? distances[i] / total : 0]));
}

/** One sector: dollar-equal legs of sectorGross / 2, name cap applied, legs trimmed to stay neutral. */
export function sizeSector(sectorScores: CompanyScore[], sectorGross: number, nameCap = Infinity) {
  const { longs, shorts, median: med } = selectSides(sectorScores);
  if (longs.length === 0 || shorts.length === 0) return { positions: [] as LsPosition[], used: 0 };
  const half = sectorGross / 2;
  const fill = (leg: CompanyScore[]) => {
    const shares = legShares(leg, med);
    return waterfill(half, leg.map((s) => ({ key: s.ticker, pref: shares.get(s.ticker)!, cap: nameCap })));
  };
  const longFill = fill(longs);
  const shortFill = fill(shorts);
  const longTotal = half - longFill.leftover;
  const shortTotal = half - shortFill.leftover;
  const legSize = Math.min(longTotal, shortTotal);
  const longScale = longTotal > 0 ? legSize / longTotal : 0;
  const shortScale = shortTotal > 0 ? legSize / shortTotal : 0;

  const positions: LsPosition[] = [
    ...longs.map((s) => ({ ticker: s.ticker, sector: s.sector, side: "long" as const, weight: longFill.alloc.get(s.ticker)! * longScale })),
    ...shorts.map((s) => ({ ticker: s.ticker, sector: s.sector, side: "short" as const, weight: shortFill.alloc.get(s.ticker)! * shortScale })),
  ].filter((p) => p.weight > 1e-12);
  return { positions, used: 2 * legSize };
}

export function buildLongShort(scores: Map<string, CompanyScore>, dispersion: SectorDispersion[]): LongShortBook {
  const events: string[] = [];
  const bySector = groupBySector(scores.values());
  const tradeable = dispersion.filter((d) => d.tradeable && d.scoreIqr > 0);
  const sectorCap = LS_LIMITS.sectorCapOfGross * LS_LIMITS.gross;
  const nameCap = LS_LIMITS.nameCapOfGross * LS_LIMITS.gross;

  const sectorFill = waterfill(
    LS_LIMITS.gross,
    tradeable.map((d) => ({ key: d.sector, pref: d.scoreIqr, cap: sectorCap })),
  );
  if (sectorFill.leftover > 1e-9) {
    events.push(`sector cap leaves ${(sectorFill.leftover * 100).toFixed(1)}% of capital unallocated`);
  }

  const positions: LsPosition[] = [];
  const sectorGross = new Map<string, number>();
  for (const d of tradeable) {
    const allotted = sectorFill.alloc.get(d.sector)!;
    const { positions: sectorPositions, used } = sizeSector(bySector.get(d.sector) ?? [], allotted, nameCap);
    if (allotted - used > 1e-9) {
      events.push(`${d.sector}: ${((allotted - used) * 100).toFixed(1)}% of capital left in cash by name cap or missing leg`);
    }
    sectorGross.set(d.sector, used);
    positions.push(...sectorPositions);
  }

  const gross = positions.reduce((a, p) => a + p.weight, 0);
  const net = positions.reduce((a, p) => a + (p.side === "long" ? p.weight : -p.weight), 0);
  return { positions, gross, net, cash: LS_LIMITS.gross - gross, sectorGross, events };
}
