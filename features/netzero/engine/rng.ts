/** Small seeded PRNG so fixtures and stress-test results are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standardNormal(rng: () => number): number {
  const u = rng() || 1e-12;
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) via Marsaglia–Tsang (shape ≥ 1) with the standard boost for shape < 1. */
export function gammaSample(shape: number, rng: () => number): number {
  if (shape < 1) {
    const u = rng() || 1e-12;
    return gammaSample(shape + 1, rng) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  for (;;) {
    const x = standardNormal(rng);
    const v = 1 + x / Math.sqrt(9 * d);
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = rng() || 1e-12;
    if (u < 1 - 0.0331 * x ** 4) return d * v3;
    if (Math.log(u) < 0.5 * x * x + d - d * v3 + d * Math.log(v3)) return d * v3;
  }
}

/** Dirichlet sample; zero alphas stay zero. */
export function dirichletSample(alphas: number[], rng: () => number): number[] {
  const draws = alphas.map((a) => (a > 0 ? gammaSample(a, rng) : 0));
  const total = draws.reduce((s, x) => s + x, 0);
  if (total <= 0) return alphas.map(() => 1 / alphas.length);
  return draws.map((x) => x / total);
}
