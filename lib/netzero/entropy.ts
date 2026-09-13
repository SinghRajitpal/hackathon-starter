/** Divergence/weight values below this are floating-point residue on a constant column, not signal. */
export const WEIGHT_EPSILON = 1e-12;

/** Entropy weight method (PDF §7). columns[j][i] = normalised value of company i on variable j. */
export function entropyWeights(columns: number[][]): number[] {
  const n = columns[0]?.length ?? 0;
  const divergence = columns.map((col) => {
    const total = col.reduce((a, b) => a + b, 0);
    if (n < 2 || total <= 0) return 0;
    let e = 0;
    for (const x of col) {
      const p = x / total;
      if (p > 0) e -= p * Math.log(p);
    }
    const d = Math.max(0, 1 - e / Math.log(n));
    return d < WEIGHT_EPSILON ? 0 : d;
  });
  const totalDivergence = divergence.reduce((a, b) => a + b, 0);
  if (totalDivergence <= 0) return columns.map(() => 1 / columns.length);
  return divergence.map((d) => d / totalDivergence);
}

export interface CappedWeights {
  weights: number[];
  cap: number;
  events: string[];
}

/**
 * Part 1 §7.1 guardrail cited by PDF §7: no weight above `cap`, excess redistributed
 * proportionally. [gap] If fewer than 1/cap variables are non-zero the cap is relaxed.
 */
export function capWeights(weights: number[], cap: number | null, names: readonly string[]): CappedWeights {
  if (cap === null) return { weights: [...weights], cap: 1, events: [] };
  const nonZero = weights.filter((w) => w > WEIGHT_EPSILON).length;
  const effective = nonZero > 0 ? Math.max(cap, 1 / nonZero) : cap;
  const events: string[] = [];
  if (effective > cap) events.push(`cap relaxed to ${effective.toFixed(3)} (${nonZero} non-zero variables)`);

  const w = [...weights];
  const capped = new Set<number>();
  for (let round = 0; round < w.length; round++) {
    let excess = 0;
    w.forEach((x, j) => {
      if (!capped.has(j) && x > effective + WEIGHT_EPSILON) {
        events.push(`${names[j]} weight ${x.toFixed(3)} capped at ${effective.toFixed(3)}`);
        excess += x - effective;
        w[j] = effective;
        capped.add(j);
      }
    });
    if (excess <= 0) break;
    const freeTotal = w.reduce((a, x, j) => (capped.has(j) || x < WEIGHT_EPSILON ? a : a + x), 0);
    if (freeTotal <= 0) break;
    w.forEach((x, j) => {
      if (!capped.has(j) && x >= WEIGHT_EPSILON) w[j] = x + (excess * x) / freeTotal;
    });
  }
  return { weights: w, cap: effective, events };
}
