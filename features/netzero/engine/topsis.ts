export interface TopsisRow {
  score: number;
  dPlus: number;
  dMinus: number;
  /** Share of the squared weighted distance to the ideal owned by each variable (PDF §7 decomposition). */
  shares: number[];
}

/** rows[i][j] in [0, 1], 1 = best. Ideal = all ones, anti-ideal = all zeros. */
export function topsis(rows: number[][], weights: number[]): TopsisRow[] {
  return rows.map((x) => {
    const gaps = x.map((v, j) => weights[j] * (1 - v) ** 2);
    const gapTotal = gaps.reduce((a, b) => a + b, 0);
    const dPlus = Math.sqrt(gapTotal);
    const dMinus = Math.sqrt(x.reduce((a, v, j) => a + weights[j] * v * v, 0));
    const score = dPlus + dMinus === 0 ? 0 : (100 * dMinus) / (dPlus + dMinus);
    return { score, dPlus, dMinus, shares: gaps.map((g) => (gapTotal > 0 ? g / gapTotal : 0)) };
  });
}
