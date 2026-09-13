import { sectorDispersion } from "./dispersion";
import { buildLongOnly, type LongOnlyBook, type LongOnlyLimits, type LoWeight } from "./longOnly";
import { buildLongShort, LS_LIMITS, type LongShortBook } from "./longShort";
import { dirichletSample, mulberry32 } from "./rng";
import { groupBySector, prepareScenario, scoreScenario, type PreparedScenario } from "./scenario";
import { CATEGORIES, CATEGORY_LABEL, type CompanyInput, type MacVector, type ScenarioConfig } from "./types";
import { waterfill } from "./waterfill";

export interface MacScenario {
  id: string;
  label: string;
  mac: MacVector;
}

/** PDF §11: base, all ±50%, each category doubled on its own. */
export function macScenarios(base: MacVector): MacScenario[] {
  const scaled = (factor: number) => Object.fromEntries(CATEGORIES.map((c) => [c, base[c] * factor])) as MacVector;
  return [
    { id: "base", label: "Base", mac: { ...base } },
    { id: "all-0.5", label: "All costs −50%", mac: scaled(0.5) },
    { id: "all-1.5", label: "All costs +50%", mac: scaled(1.5) },
    ...CATEGORIES.map((c) => ({ id: `${c}-x2`, label: `${CATEGORY_LABEL[c]} ×2`, mac: { ...base, [c]: base[c] * 2 } })),
  ];
}

/** [gap] Dirichlet concentration: α = 100 × entropy weight. */
export const DIRICHLET_CONCENTRATION = 100;
/** [gap] A pick is robust if it keeps its direction in every MAC run and in ≥ 90% of weight draws. */
export const DRAW_SURVIVAL_THRESHOLD = 0.9;

export type Signs = Map<string, number>;

/** [gap] A long-only position counts as a pick only once its active weight reaches 1bp; smaller tilts are noise. */
export const PICK_ACTIVE_THRESHOLD = 0.0001;

/** Signs of the long-only tilt's picks: active weights below PICK_ACTIVE_THRESHOLD are not picks. */
export function longOnlySigns(book: LongOnlyBook): Signs {
  const signs: Signs = new Map();
  for (const w of book.weights.values()) {
    if (Math.abs(w.active) >= PICK_ACTIVE_THRESHOLD) signs.set(w.ticker, Math.sign(w.active));
  }
  return signs;
}

/** Direction of every position for the configured mandate: +1 long/overweight, −1 short/underweight. */
export function bookSigns(
  prepared: PreparedScenario,
  companies: CompanyInput[],
  config: ScenarioConfig,
  weightOverride?: Map<string, number[]>,
  limits?: LongOnlyLimits,
): Signs {
  const { scores } = scoreScenario(prepared, weightOverride);
  const dispersion = sectorDispersion(scores.values(), config);
  const signs: Signs = new Map();
  if (config.mandate === "long-short") {
    for (const p of buildLongShort(scores, dispersion).positions) signs.set(p.ticker, p.side === "long" ? 1 : -1);
  } else {
    for (const [ticker, sign] of longOnlySigns(buildLongOnly(scores, companies, dispersion, limits))) signs.set(ticker, sign);
  }
  return signs;
}

export type Survival = "all" | "most" | "few";

export interface PickSurvival {
  ticker: string;
  baseSign: number;
  macSame: number;
  macRuns: number;
  macSurvival: Survival;
  /** Opposite direction under the all −50% or all +50% run. */
  flippedUnder50: boolean;
  drawSurvival: number;
  robust: boolean;
}

export interface SensitivityResult {
  scenarios: MacScenario[];
  picks: PickSurvival[];
  /** Share of picks that are robust (PDF §11 headline). */
  headline: number;
  draws: number;
  seed: number;
}

export function runSensitivity(
  companies: CompanyInput[],
  config: ScenarioConfig,
  { draws = 1000, seed = 42, limits }: { draws?: number; seed?: number; limits?: LongOnlyLimits } = {},
): SensitivityResult {
  const scenarios = macScenarios(config.mac);
  const prepared = prepareScenario(companies, config);
  const baseSigns = bookSigns(prepared, companies, config, undefined, limits);
  const picks = [...baseSigns.entries()];

  const runs = scenarios.slice(1).map((s) => {
    const cfg = { ...config, mac: s.mac };
    return { id: s.id, signs: bookSigns(prepareScenario(companies, cfg), companies, cfg, undefined, limits) };
  });

  const rng = mulberry32(seed);
  const drawSame = new Map(picks.map(([ticker]) => [ticker, 0]));
  for (let k = 0; k < draws; k++) {
    const override = new Map(
      prepared.sectors.map((s) => [s.sector, dirichletSample(s.weights.map((w) => w * DIRICHLET_CONCENTRATION), rng)]),
    );
    const signs = bookSigns(prepared, companies, config, override, limits);
    for (const [ticker, sign] of picks) if ((signs.get(ticker) ?? 0) === sign) drawSame.set(ticker, drawSame.get(ticker)! + 1);
  }

  const result: PickSurvival[] = picks.map(([ticker, baseSign]) => {
    const macSame = runs.filter((r) => (r.signs.get(ticker) ?? 0) === baseSign).length;
    const macRuns = runs.length;
    const macSurvival: Survival = macSame === macRuns ? "all" : macSame * 2 >= macRuns ? "most" : "few";
    const flippedUnder50 = runs
      .filter((r) => r.id === "all-0.5" || r.id === "all-1.5")
      .some((r) => (r.signs.get(ticker) ?? 0) === -baseSign);
    const drawSurvival = draws > 0 ? drawSame.get(ticker)! / draws : 1;
    return {
      ticker,
      baseSign,
      macSame,
      macRuns,
      macSurvival,
      flippedUnder50,
      drawSurvival,
      robust: macSurvival === "all" && drawSurvival >= DRAW_SURVIVAL_THRESHOLD,
    };
  });

  const robust = result.filter((p) => p.robust).length;
  return { scenarios, picks: result, headline: result.length ? robust / result.length : 0, draws, seed };
}

export function flippedTickers(result: SensitivityResult): Set<string> {
  return new Set(result.picks.filter((p) => p.flippedUnder50).map((p) => p.ticker));
}

/** PDF §11: halve flipped positions, then trim each sector's legs back to dollar neutrality. */
export function halveLongShort(book: LongShortBook, flipped: Set<string>): LongShortBook {
  const halved = book.positions.map((p) => (flipped.has(p.ticker) ? { ...p, weight: p.weight / 2 } : p));
  const positions: typeof halved = [];
  const sectorGross = new Map<string, number>();
  for (const [sector, members] of groupBySector(halved)) {
    const longTotal = members.filter((p) => p.side === "long").reduce((a, p) => a + p.weight, 0);
    const shortTotal = members.filter((p) => p.side === "short").reduce((a, p) => a + p.weight, 0);
    const leg = Math.min(longTotal, shortTotal);
    for (const p of members) {
      const total = p.side === "long" ? longTotal : shortTotal;
      positions.push({ ...p, weight: total > 0 ? (p.weight * leg) / total : 0 });
    }
    sectorGross.set(sector, 2 * leg);
  }
  const gross = positions.reduce((a, p) => a + p.weight, 0);
  const net = positions.reduce((a, p) => a + (p.side === "long" ? p.weight : -p.weight), 0);
  return { ...book, positions, gross, net, cash: LS_LIMITS.gross - gross, sectorGross };
}

/** PDF §11 for the tilt: halve flipped active weights, offset the change inside the sector so sector weight holds. */
export function halveLongOnly(book: LongOnlyBook, flipped: Set<string>): LongOnlyBook {
  const weights = new Map(book.weights);
  for (const [, members] of groupBySector([...book.weights.values()])) {
    let residual = 0;
    for (const w of members) {
      if (!flipped.has(w.ticker)) continue;
      const active = w.active / 2;
      residual += active - w.active;
      weights.set(w.ticker, { ...w, active, portfolio: w.benchmark + active });
    }
    if (Math.abs(residual) < 1e-12) continue;
    const direction = Math.sign(residual);
    const others = members.filter((w) => !flipped.has(w.ticker));
    const candidates = others.filter((w) => (direction > 0 ? w.active > 1e-12 : w.active < -1e-12));
    const fill = waterfill(
      Math.abs(residual),
      candidates.map((w) => ({ key: w.ticker, pref: Math.abs(w.active), cap: Math.abs(w.active) })),
    );
    const benchTotal = others.reduce((a, w) => a + w.benchmark, 0);
    for (const w of others) {
      const moved = (fill.alloc.get(w.ticker) ?? 0) + (benchTotal > 0 ? (fill.leftover * w.benchmark) / benchTotal : 0);
      const active = w.active - direction * moved;
      weights.set(w.ticker, { ...w, active, portfolio: w.benchmark + active } satisfies LoWeight);
    }
  }
  const sectorWeights = new Map<string, { benchmark: number; portfolio: number }>();
  for (const w of weights.values()) {
    const s = sectorWeights.get(w.sector) ?? { benchmark: 0, portfolio: 0 };
    sectorWeights.set(w.sector, { benchmark: s.benchmark + w.benchmark, portfolio: s.portfolio + w.portfolio });
  }
  return { ...book, weights, sectorWeights };
}
