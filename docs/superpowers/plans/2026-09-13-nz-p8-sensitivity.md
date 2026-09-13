# P8 Sensitivity and Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stress-test every book against the abatement-cost assumptions and against random weight perturbations (PDF §11), halve positions that flip under ±50% costs, run the 2019 burden-versus-decarbonisation check, and let a user run the stress test for one ticker from the risk panel.

**Architecture:** `rng.ts` gains a Gamma sampler and a Dirichlet sampler. `sensitivity.ts` rebuilds the configured book under 8 MAC scenarios and 1,000 seeded Dirichlet weight draws, then reports survival per position and a headline robustness share. `validation.ts` summarises the 2019 check. A Python script `18_validation_2019.py` produces the 2019 check data from GHGRP and SEC companyfacts. The ticker panel gets its final form: a stress-test section on a button, plus a link to `/portfolio`.

**Tech Stack:** TypeScript 5, vitest 5, React 19.3 client components, Python 3 via uv, pandas, requests, pytest.

**Spec:** `docs/superpowers/specs/2026-09-13-net-zero-scenario-design.md` (§6 `sensitivity.ts`, §9 invariants, §10 P8). Index: `docs/superpowers/plans/2026-09-13-nz-00-index.md`.

## Global Constraints

See the index. P1 and P5–P7 must be merged into `part-2` first. Gap rules used here are already in `docs/decisions-log.md`: Dirichlet α = 100 × entropy weight, seed 42, 1,000 draws; survival "all" = same direction in every MAC run, "most" = at least half, "few" = fewer than half; robust = all MAC runs and ≥ 90% of draws. Benchmark on a 503-company universe: 1,000 draws take 350–500 ms, so the stress test runs synchronously on a button click (no Web Worker). The §11 validation check has a hard two-hour time box (Task 5).

---

## P8 — branch `nz/p8-sensitivity`

### Task 1: Gamma and Dirichlet samplers

**Files:**
- Modify: `lib/netzero/rng.ts` (P2 created it with `mulberry32` only)
- Test: `lib/netzero/rng.test.ts`

**Interfaces:**
- Consumes: `mulberry32` (P2).
- Produces: `gammaSample(shape: number, rng: () => number): number`; `dirichletSample(alphas: number[], rng: () => number): number[]` (zero alphas stay zero; all-zero alphas return equal weights).

- [ ] **Step 1: Branch**

```bash
git switch part-2 && git switch -c nz/p8-sensitivity
```

- [ ] **Step 2: Write the failing test** — `lib/netzero/rng.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { dirichletSample, gammaSample, mulberry32 } from "./rng";

describe("gammaSample", () => {
  it.each([0.5, 3, 40])("has mean ≈ shape and variance ≈ shape for shape %s", (shape) => {
    const rng = mulberry32(123);
    const n = 40000;
    const xs = Array.from({ length: n }, () => gammaSample(shape, rng));
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    expect(Math.abs(mean - shape) / shape).toBeLessThan(0.03);
    expect(Math.abs(variance - shape) / shape).toBeLessThan(0.08);
  });
});

describe("dirichletSample", () => {
  it("sums to 1 and keeps zero alphas at zero", () => {
    const rng = mulberry32(7);
    for (let k = 0; k < 100; k++) {
      const draw = dirichletSample([10, 0, 30], rng);
      expect(draw.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(draw[1]).toBe(0);
      expect(draw[0]).toBeGreaterThan(0);
    }
  });

  it("centres on alpha / sum(alpha)", () => {
    const rng = mulberry32(11);
    const n = 5000;
    let first = 0;
    for (let k = 0; k < n; k++) first += dirichletSample([20, 80], rng)[0];
    expect(first / n).toBeCloseTo(0.2, 2);
  });

  it("returns equal weights when every alpha is zero", () => {
    expect(dirichletSample([0, 0], mulberry32(1))).toEqual([0.5, 0.5]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- lib/netzero/rng.test.ts`
Expected: FAIL — `gammaSample is not a function` or a missing export.

- [ ] **Step 4: Replace `lib/netzero/rng.ts`** (full final file)

```ts
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
```

- [ ] **Step 5: Run tests** — `npm test -- lib/netzero/rng.test.ts lib/netzero/stats.test.ts` → Expected: PASS (6 tests in rng, P2 stats tests still pass).

- [ ] **Step 6: Commit**

```bash
git add lib/netzero/rng.ts lib/netzero/rng.test.ts
git commit -m "feat: add seeded Gamma and Dirichlet samplers"
```

---

### Task 2: Sensitivity re-runs, weight perturbation and halving

**Files:**
- Create: `lib/netzero/sensitivity.ts`
- Test: `lib/netzero/sensitivity.test.ts`

**Interfaces:**
- Consumes: `sectorDispersion` (P5), `buildLongShort`, `LongShortBook` (P6), `buildLongOnly`, `LongOnlyBook`, `LoWeight` (P7), `prepareScenario`, `scoreScenario`, `groupBySector`, `PreparedScenario` (P3), `waterfill` (P6), `dirichletSample`, `mulberry32` (Task 1), `CATEGORIES`, `CATEGORY_LABEL`, `CompanyInput`, `MacVector`, `ScenarioConfig` (P0).
- Produces:
  - `MacScenario = { id: string; label: string; mac: MacVector }`; `macScenarios(base: MacVector): MacScenario[]` — ids in order `base`, `all-0.5`, `all-1.5`, `scope2-x2`, `combustion-x2`, `fleet-x2`, `process-x2`, `fugitive-x2`.
  - `DIRICHLET_CONCENTRATION = 100`, `DRAW_SURVIVAL_THRESHOLD = 0.9`.
  - `Signs = Map<string, number>`; `bookSigns(prepared, companies, config, weightOverride?): Signs`.
  - `Survival = "all" | "most" | "few"`; `PickSurvival = { ticker; baseSign; macSame; macRuns; macSurvival; flippedUnder50; drawSurvival; robust }`.
  - `SensitivityResult = { scenarios: MacScenario[]; picks: PickSurvival[]; headline: number; draws: number; seed: number }`.
  - `runSensitivity(companies, config, { draws = 1000, seed = 42 } = {}): SensitivityResult`.
  - `flippedTickers(result): Set<string>`; `halveLongShort(book, flipped): LongShortBook`; `halveLongOnly(book, flipped): LongOnlyBook`.

- [ ] **Step 1: Write the failing test** — `lib/netzero/sensitivity.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { runEngine } from "./engine";
import { DEFAULT_TEST_CONFIG, MID_MAC, syntheticUniverse } from "./fixtures";
import { groupBySector } from "./scenario";
import {
  DRAW_SURVIVAL_THRESHOLD,
  flippedTickers,
  halveLongOnly,
  halveLongShort,
  macScenarios,
  runSensitivity,
} from "./sensitivity";

const EPS = 1e-9;
const companies = syntheticUniverse();

describe("macScenarios (PDF §11)", () => {
  it("returns base, all ±50% and each category doubled on its own", () => {
    const scenarios = macScenarios(MID_MAC);
    expect(scenarios.map((s) => s.id)).toEqual([
      "base",
      "all-0.5",
      "all-1.5",
      "scope2-x2",
      "combustion-x2",
      "fleet-x2",
      "process-x2",
      "fugitive-x2",
    ]);
    expect(scenarios[1].mac.combustion).toBe(60);
    expect(scenarios[2].mac.fleet).toBe(300);
    expect(scenarios[5].mac.fleet).toBe(400);
    expect(scenarios[5].mac.combustion).toBe(120);
  });
});

describe("runSensitivity", () => {
  const config = { ...DEFAULT_TEST_CONFIG, mandate: "long-short" as const };
  const result = runSensitivity(companies, config, { draws: 25, seed: 7 });

  it("is reproducible for a fixed seed and reports a headline in [0, 1]", () => {
    const again = runSensitivity(companies, config, { draws: 25, seed: 7 });
    expect(again.picks).toEqual(result.picks);
    expect(result.scenarios).toHaveLength(8);
    expect(result.picks.length).toBeGreaterThan(0);
    expect(result.headline).toBeGreaterThanOrEqual(0);
    expect(result.headline).toBeLessThanOrEqual(1);
  });

  it("classifies survival consistently with its definitions", () => {
    for (const p of result.picks) {
      expect(p.macRuns).toBe(7);
      const expected = p.macSame === 7 ? "all" : p.macSame * 2 >= 7 ? "most" : "few";
      expect(p.macSurvival).toBe(expected);
      expect(p.robust).toBe(p.macSurvival === "all" && p.drawSurvival >= DRAW_SURVIVAL_THRESHOLD);
      expect(Math.abs(p.baseSign)).toBe(1);
    }
    const robust = result.picks.filter((p) => p.robust).length;
    expect(result.headline).toBeCloseTo(robust / result.picks.length, 12);
  });

  it("lists exactly the picks that flip under ±50% costs", () => {
    expect([...flippedTickers(result)].sort()).toEqual(
      result.picks.filter((p) => p.flippedUnder50).map((p) => p.ticker).sort(),
    );
  });

  it("covers the long-only mandate too", () => {
    const lo = runSensitivity(companies, DEFAULT_TEST_CONFIG, { draws: 10, seed: 3 });
    expect(lo.picks.length).toBeGreaterThan(0);
    expect(lo.draws).toBe(10);
    expect(lo.seed).toBe(3);
  });
});

describe("halving flipped positions", () => {
  const result = runEngine(companies, DEFAULT_TEST_CONFIG);

  it("keeps the long/short book dollar-neutral in every sector", () => {
    const flipped = new Set(result.longShort.positions.slice(0, 3).map((p) => p.ticker));
    const book = halveLongShort(result.longShort, flipped);
    expect(Math.abs(book.net)).toBeLessThan(EPS);
    expect(book.gross).toBeLessThan(result.longShort.gross + EPS);
    for (const [, members] of groupBySector(book.positions)) {
      const long = members.filter((p) => p.side === "long").reduce((a, p) => a + p.weight, 0);
      const short = members.filter((p) => p.side === "short").reduce((a, p) => a + p.weight, 0);
      expect(long).toBeCloseTo(short, 9);
    }
  });

  it("keeps long-only sector weights at benchmark and halves the flipped active weights", () => {
    const tilted = [...result.longOnly.weights.values()].filter((w) => Math.abs(w.active) > EPS).slice(0, 4);
    const book = halveLongOnly(result.longOnly, new Set(tilted.map((w) => w.ticker)));
    for (const { benchmark, portfolio } of book.sectorWeights.values()) expect(portfolio).toBeCloseTo(benchmark, 9);
    for (const w of tilted) expect(book.weights.get(w.ticker)!.active).toBeCloseTo(w.active / 2, 12);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- lib/netzero/sensitivity.test.ts`
Expected: FAIL — `Failed to resolve import "./sensitivity"`.

- [ ] **Step 3: Implement** — `lib/netzero/sensitivity.ts`

```ts
import { sectorDispersion } from "./dispersion";
import { buildLongOnly, type LongOnlyBook, type LoWeight } from "./longOnly";
import { buildLongShort, type LongShortBook } from "./longShort";
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

/** Direction of every position for the configured mandate: +1 long/overweight, −1 short/underweight. */
export function bookSigns(
  prepared: PreparedScenario,
  companies: CompanyInput[],
  config: ScenarioConfig,
  weightOverride?: Map<string, number[]>,
): Signs {
  const { scores } = scoreScenario(prepared, weightOverride);
  const dispersion = sectorDispersion(scores.values(), config);
  const signs: Signs = new Map();
  if (config.mandate === "long-short") {
    for (const p of buildLongShort(scores, dispersion).positions) signs.set(p.ticker, p.side === "long" ? 1 : -1);
  } else {
    for (const w of buildLongOnly(scores, companies, dispersion).weights.values()) {
      if (Math.abs(w.active) > 1e-9) signs.set(w.ticker, Math.sign(w.active));
    }
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
  { draws = 1000, seed = 42 }: { draws?: number; seed?: number } = {},
): SensitivityResult {
  const scenarios = macScenarios(config.mac);
  const prepared = prepareScenario(companies, config);
  const baseSigns = bookSigns(prepared, companies, config);
  const picks = [...baseSigns.entries()];

  const runs = scenarios.slice(1).map((s) => {
    const cfg = { ...config, mac: s.mac };
    return { id: s.id, signs: bookSigns(prepareScenario(companies, cfg), companies, cfg) };
  });

  const rng = mulberry32(seed);
  const drawSame = new Map(picks.map(([ticker]) => [ticker, 0]));
  for (let k = 0; k < draws; k++) {
    const override = new Map(
      prepared.sectors.map((s) => [s.sector, dirichletSample(s.weights.map((w) => w * DIRICHLET_CONCENTRATION), rng)]),
    );
    const signs = bookSigns(prepared, companies, config, override);
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
  return { ...book, positions, gross, net, cash: 2 - gross, sectorGross };
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
```

- [ ] **Step 4: Run tests** — `npm test` → Expected: every file passes, including `sensitivity.test.ts` (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/netzero/sensitivity.ts lib/netzero/sensitivity.test.ts
git commit -m "feat: stress-test books under cost scenarios and weight perturbations"
```

---

### Task 3: 2019 validation summary helper

**Files:**
- Create: `lib/netzero/validation.ts`
- Test: `lib/netzero/validation.test.ts`

**Interfaces:**
- Consumes: `spearman` (P2), `ValidationRow` (P0).
- Produces: `ValidationSummary = { n: number; spearman: number | null; bySector: Record<string, number> }`; `validationSummary(rows: ValidationRow[]): ValidationSummary`. `n` and `bySector` count only rows with both `tbr2019` and `intensityChange`; `spearman` is null below 3 such rows. P9's stress tab card uses it. Reading: the PDF §11 hypothesis (low burden → faster decarbonisation) predicts a **positive** correlation between `tbr2019` and `intensityChange` (low TBR pairs with the most negative change).

- [ ] **Step 1: Write the failing test** — `lib/netzero/validation.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { ValidationRow } from "./types";
import { validationSummary } from "./validation";

const row = (ticker: string, sector: string, tbr2019: number | null, intensityChange: number | null): ValidationRow => ({
  ticker,
  sector,
  tbr2019,
  intensity2019: null,
  intensityLatest: null,
  intensityChange,
});

describe("validationSummary (PDF §11)", () => {
  it("uses only rows with both values and computes Spearman", () => {
    const summary = validationSummary([
      row("A", "Utilities", 0.1, -0.4),
      row("B", "Utilities", 0.5, -0.2),
      row("C", "Energy", 0.9, 0.1),
      row("D", "Energy", null, -0.3),
      row("E", "Energy", 0.3, null),
    ]);
    expect(summary.n).toBe(3);
    expect(summary.spearman).toBeCloseTo(1, 12);
    expect(summary.bySector).toEqual({ Utilities: 2, Energy: 1 });
  });

  it("returns a null correlation below three usable rows", () => {
    expect(validationSummary([row("A", "X", 0.1, -0.1), row("B", "X", 0.2, 0)]).spearman).toBeNull();
    expect(validationSummary([])).toEqual({ n: 0, spearman: null, bySector: {} });
  });
});
```

- [ ] **Step 2: Run it to verify it fails** — `npm test -- lib/netzero/validation.test.ts` → FAIL, `Failed to resolve import "./validation"`.

- [ ] **Step 3: Implement** — `lib/netzero/validation.ts`

```ts
import { spearman } from "./stats";
import type { ValidationRow } from "./types";

export interface ValidationSummary {
  /** Rows with both a 2019 TBR and an intensity change. */
  n: number;
  /** Spearman rank correlation of tbr2019 vs intensityChange; null below 3 usable rows. */
  spearman: number | null;
  bySector: Record<string, number>;
}

/** PDF §11 check: did low-burden companies decarbonise faster? Expect a positive correlation if so. */
export function validationSummary(rows: ValidationRow[]): ValidationSummary {
  const usable = rows.filter((r) => r.tbr2019 !== null && r.intensityChange !== null);
  const bySector: Record<string, number> = {};
  for (const r of usable) bySector[r.sector] = (bySector[r.sector] ?? 0) + 1;
  return {
    n: usable.length,
    spearman:
      usable.length >= 3
        ? spearman(
            usable.map((r) => r.tbr2019 as number),
            usable.map((r) => r.intensityChange as number),
          )
        : null,
    bySector,
  };
}
```

- [ ] **Step 4: Run tests** — `npm test -- lib/netzero/validation.test.ts` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/netzero/validation.ts lib/netzero/validation.test.ts
git commit -m "feat: summarise the 2019 burden versus decarbonisation check"
```

---

### Task 4: Stress-test section and final ticker risk panel

**Files:**
- Create: `components/netzero/sections/stress-section.tsx`
- Modify: `components/netzero/ticker-risk-panel.tsx` (final version; P9 does not edit it)

**Interfaces:**
- Consumes: `runSensitivity`, `SensitivityResult` (Task 2); `formatPercent` (P0); `Button` from `components/ui/button.tsx`; all P3–P7 sections.
- Produces: `STRESS_DRAWS = 1000`, `STRESS_SEED = 42`; `<StressSection ticker: string; companies: CompanyInput[]; config: ScenarioConfig />`; panel link `Open in portfolio →` to `/portfolio?ticker=<TICKER>` (P9 reads the `ticker` search param).

- [ ] **Step 1: Create `components/netzero/sections/stress-section.tsx`**

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/netzero/format";
import { runSensitivity, type SensitivityResult } from "@/lib/netzero/sensitivity";
import type { CompanyInput, ScenarioConfig } from "@/lib/netzero/types";

/** PDF §11 via the decisions log: 1,000 seeded Dirichlet draws. ~0.5 s on 503 companies. */
export const STRESS_DRAWS = 1000;
export const STRESS_SEED = 42;

const SURVIVAL_TEXT = {
  all: "keeps its direction in all 7 cost scenarios",
  most: "keeps its direction in most cost scenarios",
  few: "keeps its direction in few cost scenarios",
} as const;

export function StressSection({
  ticker,
  companies,
  config,
}: {
  ticker: string;
  companies: CompanyInput[];
  config: ScenarioConfig;
}) {
  const [result, setResult] = useState<SensitivityResult | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // Yield one frame so "Running…" paints before the synchronous run blocks the main thread.
    setTimeout(() => {
      setResult(runSensitivity(companies, config, { draws: STRESS_DRAWS, seed: STRESS_SEED }));
      setRunning(false);
    }, 0);
  }

  const pick = result?.picks.find((p) => p.ticker === ticker);
  const book = config.mandate === "long-short" ? "long/short" : "long-only";

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Stress test</h3>
      <div>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running ? "Running…" : result ? "Run again" : "Run stress test"}
        </Button>
      </div>
      {result && (
        <>
          {pick ? (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                {ticker} {SURVIVAL_TEXT[pick.macSurvival]} ({pick.macSame}/{pick.macRuns}) and in{" "}
                {formatPercent(pick.drawSurvival)} of {result.draws.toLocaleString()} weight draws.
              </p>
              <p className={pick.robust ? "font-semibold text-primary" : "font-semibold text-muted-foreground"}>
                {pick.robust ? "Robust pick" : "Not robust"}
              </p>
              {pick.flippedUnder50 && (
                <p className="text-xs text-destructive">Flips direction under ±50% costs: position is halved.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ticker} has no position in the {book} book, so there is nothing to stress.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Book-wide: {formatPercent(result.headline)} of {result.picks.length} {book} picks are robust (seed{" "}
            {result.seed}).
          </p>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Replace `components/netzero/ticker-risk-panel.tsx`** (final full file)

```tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

import { BurdenSection } from "@/components/netzero/sections/burden-section";
import { InputsSection } from "@/components/netzero/sections/inputs-section";
import { PositionSection } from "@/components/netzero/sections/position-section";
import { ScoreSection } from "@/components/netzero/sections/score-section";
import { SectorContextSection } from "@/components/netzero/sections/sector-context-section";
import { StressSection } from "@/components/netzero/sections/stress-section";
import { defaultConfig, macVector } from "@/lib/netzero/config";
import { runEngine } from "@/lib/netzero/engine";
import type { ScenarioData } from "@/lib/netzero/types";

export function NetZeroRiskPanel({ ticker, data }: { ticker: string; data: ScenarioData }) {
  const run = useMemo(() => {
    if (data.error || data.companies.length === 0) return null;
    const config = defaultConfig(macVector(data.macRows).mac);
    return { config, result: runEngine(data.companies, config) };
  }, [data]);

  if (data.error) {
    return <p className="text-sm text-destructive">Net-zero scenario data failed to load: {data.error}</p>;
  }
  const company = data.companies.find((c) => c.ticker === ticker);
  if (!company || !run) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.companies.length === 0
          ? "Net-zero scenario data is not loaded yet."
          : `${ticker} is not in the net-zero scenario universe.`}
      </p>
    );
  }

  const score = run.result.scores.get(ticker)!;
  const model = run.result.sectors.find((s) => s.sector === company.sector)!;
  const dispersion = run.result.dispersion.find((d) => d.sector === company.sector)!;

  return (
    <div className="flex flex-col gap-6">
      <PositionSection
        ticker={ticker}
        score={score}
        sectorMedianTbr={dispersion.medianTbr}
        longShort={run.result.longShort}
        longOnly={run.result.longOnly}
      />
      <ScoreSection score={score} model={model} />
      <BurdenSection company={company} score={score} sectorMedianTbr={dispersion.medianTbr} mac={run.config.mac} />
      <SectorContextSection
        dispersion={dispersion}
        tbrIqrThreshold={run.config.tbrIqrThreshold}
        scoreIqrThreshold={run.config.scoreIqrThreshold}
      />
      <StressSection ticker={ticker} companies={data.companies} config={run.config} />
      <InputsSection company={company} />
      <Link href={`/portfolio?ticker=${encodeURIComponent(ticker)}`} className="text-sm font-medium underline">
        Open in portfolio →
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Lint, test, build**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 4: Exercise the page**

Run `npm run dev` in the background, then:

```bash
sleep 8
curl -s "http://localhost:3000/?ticker=XOM" | grep -o "Run stress test\|Open in portfolio →" | sort -u
```

Expected: both strings. The button itself runs in the browser; open `http://localhost:3000/?ticker=XOM`, click **Run stress test**, and confirm the survival sentence and the book-wide headline appear in under two seconds. Record the headline value for the phase close. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add components/netzero
git commit -m "feat: run the stress test from the ticker panel and link to the portfolio"
```

---

### Task 5: 2019 validation data (two-hour time box)

**Files:**
- Create: `data/pipeline/nz/nzlib/validation.py`
- Test: `data/pipeline/nz/tests/test_validation.py`
- Create: `data/pipeline/nz/18_validation_2019.py`
- Modify: `docs/decisions-log.md` (append result)

**Interfaces:**
- Consumes: `data/out/sp500_esg_financials_raw.csv` (ticker, sector), `data/out/nz/ghgrp_categories.csv` from P1 script 11 (columns `ticker, year, total, combustion, process, fugitive`, rows for years 2019 and 2023), `data/out/nz/financials_ttm.csv` from P1 script 10 (`ticker, revenue_ttm`), `data/pipeline/nz/maps/mac_costs.csv` from P1 (`category, low, mid, high, source, source_date`), env `SEC_USER_AGENT`.
- Produces: `nzlib.validation.annual_value(facts, tags, year)`, `ebitda(facts, year)`, `intensity(emissions, revenue)`, `intensity_change(i2019, ilatest)`; `data/out/nz/validation_2019.csv` with columns `ticker,sector,tbr_2019,intensity_2019,intensity_latest,intensity_change`, loaded into `nz_validation_2019` by P1's `19_load_supabase.py` when the file exists.

**Time box (PDF §11):** write down the clock time before Step 1. If Step 6 has not produced `validation_2019.csv` within two hours of that time, stop, skip Steps 6–8, append the limitation entry from Step 9 (variant B), commit whatever tested code exists, and move to the phase close.

- [ ] **Step 1: Write the failing test** — `data/pipeline/nz/tests/test_validation.py`

```python
import pytest

from nzlib import validation

FACTS = {
    "facts": {
        "us-gaap": {
            "OperatingIncomeLoss": {
                "units": {
                    "USD": [
                        {"start": "2019-10-01", "end": "2019-12-31", "val": 1, "form": "10-K"},
                        {"start": "2019-01-01", "end": "2019-12-31", "val": 500, "form": "10-K"},
                    ]
                }
            },
            "DepreciationAndAmortization": {
                "units": {"USD": [{"start": "2019-01-01", "end": "2019-12-31", "val": 200, "form": "10-K"}]}
            },
        }
    }
}


def test_annual_value_skips_quarterly_facts():
    assert validation.annual_value(FACTS, validation.OPERATING_INCOME_TAGS, 2019) == 500.0
    assert validation.annual_value(FACTS, validation.OPERATING_INCOME_TAGS, 2020) is None


def test_ebitda_is_operating_income_plus_depreciation():
    assert validation.ebitda(FACTS, 2019) == 700.0
    assert validation.ebitda({"facts": {}}, 2019) is None


def test_intensity_change():
    assert validation.intensity(100.0, 1000.0) == pytest.approx(0.1)
    assert validation.intensity(100.0, 0) is None
    assert validation.intensity_change(0.1, 0.08) == pytest.approx(-0.2)
    assert validation.intensity_change(None, 0.08) is None
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd data/pipeline/nz && uv run pytest tests/test_validation.py -q`
Expected: FAIL — `ImportError: cannot import name 'validation' from 'nzlib'`.

- [ ] **Step 3: Implement** — `data/pipeline/nz/nzlib/validation.py`

```python
"""PDF §11 validation inputs: FY2019 financials from SEC companyfacts and emissions-intensity change."""
from datetime import date

REVENUE_TAGS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RegulatedAndUnregulatedOperatingRevenue",
    "SalesRevenueNet",
]
OPERATING_INCOME_TAGS = ["OperatingIncomeLoss"]
DEPRECIATION_TAGS = [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
]


def annual_value(facts: dict, tags: list[str], fiscal_year_end_year: int) -> float | None:
    """First tag with a full-year USD fact (330–400 days) ending in the given calendar year."""
    usgaap = facts.get("facts", {}).get("us-gaap", {})
    for tag in tags:
        for fact in usgaap.get(tag, {}).get("units", {}).get("USD", []):
            start, end = fact.get("start"), fact.get("end")
            if not start or not end or int(end[:4]) != fiscal_year_end_year:
                continue
            days = (date.fromisoformat(end) - date.fromisoformat(start)).days
            if 330 <= days <= 400:
                return float(fact["val"])
    return None


def ebitda(facts: dict, year: int) -> float | None:
    operating_income = annual_value(facts, OPERATING_INCOME_TAGS, year)
    depreciation = annual_value(facts, DEPRECIATION_TAGS, year)
    if operating_income is None or depreciation is None:
        return None
    return operating_income + depreciation


def intensity(emissions: float | None, revenue: float | None) -> float | None:
    if emissions is None or revenue is None or revenue <= 0:
        return None
    return emissions / revenue


def intensity_change(intensity_2019: float | None, intensity_latest: float | None) -> float | None:
    if intensity_2019 is None or intensity_latest is None or intensity_2019 <= 0:
        return None
    return intensity_latest / intensity_2019 - 1.0
```

- [ ] **Step 4: Run tests** — `cd data/pipeline/nz && uv run pytest -q` → Expected: all pass (3 new).

- [ ] **Step 5: Create `data/pipeline/nz/18_validation_2019.py`**

```python
"""PDF §11 validation: 2019 transition burden vs change in emissions intensity 2019 → latest.

Hypothesis: companies with a low 2019 burden decarbonised faster because it was cheaper for them.
GHGRP (US facilities, Scope 1 split into combustion/process/fugitive) is used for both years so the
comparison is like for like. FY2019 revenue and EBITDA come from SEC companyfacts; the latest
intensity uses TTM revenue from 10_ttm_financials.py. Two-hour time box (see the P8 plan).

Usage (from data/pipeline/nz):
  SEC_USER_AGENT="Your Name your@email" uv run python 18_validation_2019.py
Output: ../../out/nz/validation_2019.csv
"""
import json
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

from nzlib import validation

UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
GHGRP_PATH = Path("../../out/nz/ghgrp_categories.csv")
FINANCIALS_PATH = Path("../../out/nz/financials_ttm.csv")
MAC_PATH = Path("maps/mac_costs.csv")
CACHE_DIR = Path("../../raw/nz/companyfacts")
OUT_PATH = Path("../../out/nz/validation_2019.csv")

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
SLEEP_SECONDS = 0.15  # stays under SEC's 10 requests/second fair-access limit
SCOPE1_CATEGORIES = ["combustion", "process", "fugitive"]
BASE_YEAR = 2019
LATEST_YEAR = 2023


def normalise_ticker(ticker: str) -> str:
    return str(ticker).upper().replace("-", ".")


def load_facts(session: requests.Session, cik: int) -> dict | None:
    """companyfacts JSON, cached on disk so reruns make no requests."""
    path = CACHE_DIR / f"CIK{cik:010d}.json"
    if path.exists():
        return json.loads(path.read_text())
    time.sleep(SLEEP_SECONDS)
    response = session.get(FACTS_URL.format(cik=cik), timeout=60)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    path.write_text(response.text)
    return response.json()


def main():
    user_agent = os.environ.get("SEC_USER_AGENT")
    if not user_agent:
        print('Set SEC_USER_AGENT, e.g. SEC_USER_AGENT="Your Name your@email"', file=sys.stderr)
        sys.exit(1)
    session = requests.Session()
    session.headers["User-Agent"] = user_agent
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    sectors = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "sector"]).set_index("ticker")["sector"]
    ghgrp = pd.read_csv(GHGRP_PATH)
    base = ghgrp[ghgrp["year"] == BASE_YEAR].groupby("ticker")[SCOPE1_CATEGORIES].sum()
    latest = ghgrp[ghgrp["year"] == LATEST_YEAR].groupby("ticker")[SCOPE1_CATEGORIES].sum()
    revenue_ttm = pd.read_csv(FINANCIALS_PATH, usecols=["ticker", "revenue_ttm"]).set_index("ticker")["revenue_ttm"]
    mac_mid = pd.read_csv(MAC_PATH).set_index("category")["mid"]

    tickers_json = session.get(TICKERS_URL, timeout=60).json()
    ciks = {normalise_ticker(v["ticker"]): int(v["cik_str"]) for v in tickers_json.values()}

    rows = []
    both_years = sorted(set(base.index) & set(latest.index) & set(sectors.index))
    for i, ticker in enumerate(both_years, start=1):
        row = {
            "ticker": ticker,
            "sector": sectors[ticker],
            "tbr_2019": None,
            "intensity_2019": None,
            "intensity_latest": None,
            "intensity_change": None,
        }
        try:
            cik = ciks.get(normalise_ticker(ticker))
            facts = load_facts(session, cik) if cik else None
            revenue_2019 = validation.annual_value(facts, validation.REVENUE_TAGS, BASE_YEAR) if facts else None
            ebitda_2019 = validation.ebitda(facts, BASE_YEAR) if facts else None

            emissions_2019 = float(base.loc[ticker, SCOPE1_CATEGORIES].sum())
            bill_2019 = sum(float(base.loc[ticker, c]) * max(float(mac_mid[c]), 0.0) for c in SCOPE1_CATEGORIES)
            if ebitda_2019 is not None and ebitda_2019 > 0:
                row["tbr_2019"] = bill_2019 / ebitda_2019

            latest_revenue = revenue_ttm.get(ticker)
            latest_revenue = None if latest_revenue is None or pd.isna(latest_revenue) else float(latest_revenue)
            row["intensity_2019"] = validation.intensity(emissions_2019, revenue_2019)
            row["intensity_latest"] = validation.intensity(float(latest.loc[ticker, SCOPE1_CATEGORIES].sum()), latest_revenue)
            row["intensity_change"] = validation.intensity_change(row["intensity_2019"], row["intensity_latest"])
        except Exception as exc:  # noqa: BLE001 -- one bad ticker must not kill the run
            print(f"{ticker}: {exc}", file=sys.stderr)
        rows.append(row)
        if i % 25 == 0 or i == len(both_years):
            print(f"[{i}/{len(both_years)}] {ticker}")

    df = pd.DataFrame(rows, columns=["ticker", "sector", "tbr_2019", "intensity_2019", "intensity_latest", "intensity_change"])
    assert df["ticker"].is_unique, "validation must have one row per ticker"
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    usable = df.dropna(subset=["tbr_2019", "intensity_change"])
    rho = usable["tbr_2019"].rank().corr(usable["intensity_change"].rank()) if len(usable) >= 3 else float("nan")
    print(f"Wrote {len(df)} rows to {OUT_PATH}; {len(usable)} usable; Spearman(tbr_2019, intensity_change) = {rho:.3f}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the script**

Run: `cd data/pipeline/nz && SEC_USER_AGENT="<ask the user for a name + contact email>" uv run python 18_validation_2019.py`
Expected: progress lines, then `Wrote N rows to ../../out/nz/validation_2019.csv; M usable; Spearman(...) = x.xxx` with N roughly 80–110 (companies with GHGRP rows in both years). Do not invent the user agent; ask the user for it.

- [ ] **Step 7: Load it (ask first)**

Stop and ask: "The 2019 validation file is ready. May I load it into `nz_validation_2019` by rerunning `19_load_supabase.py` (it writes to the shared Supabase project)?" Only after a yes, run with the PG* variables exported: `cd data/pipeline/nz && uv run python 19_load_supabase.py`. Expected: a line reporting rows upserted into `nz_validation_2019`.

- [ ] **Step 8: Check the summary against the loaded data**

Open `http://localhost:3000/?ticker=XOM` after `npm run dev`, or run in `data/pipeline/nz`:
`uv run python -c "import pandas as pd; d=pd.read_csv('../../out/nz/validation_2019.csv').dropna(subset=['tbr_2019','intensity_change']); print(len(d), d['tbr_2019'].rank().corr(d['intensity_change'].rank()))"`
Record `n` and the correlation for Step 9.

- [ ] **Step 9: Append the result to `docs/decisions-log.md`**

Variant A (finished in time):

```markdown
## §11 validation (P8, <date>)

2019 TBR (GHGRP Scope 1 categories × mid MAC ÷ FY2019 EBITDA from SEC companyfacts) against the change in
GHGRP Scope 1 intensity from 2019 to 2023 (latest revenue = TTM). n = <n>, Spearman = <rho>.
Hypothesis (low burden → faster decarbonisation) predicts a positive correlation. Result: <supported / not supported>.
Scope: US facilities only; companies without GHGRP rows in both years are excluded.
```

Variant B (time box exceeded):

```markdown
## §11 validation (P8, <date>)

Not completed within the PDF §11 two-hour time box. Reported as a limitation: the burden-versus-decarbonisation
check was not run. Stopped at: <step reached and blocker>.
```

- [ ] **Step 10: Commit**

```bash
git add data/pipeline/nz/nzlib/validation.py data/pipeline/nz/tests/test_validation.py data/pipeline/nz/18_validation_2019.py docs/decisions-log.md
git commit -m "feat: add the 2019 burden versus decarbonisation validation"
```

(`data/out/nz/validation_2019.csv` is committed only if P1 commits the other `data/out/nz/` outputs; follow what P1 did.)

---

### P8 phase close

- [ ] `npm run lint && npm test && npm run build` and `cd data/pipeline/nz && uv run pytest -q`; paste outputs, plus the stress-test headline from Task 4 Step 4 and the Task 5 result or time-box note.
- [ ] `/code-review` on `nz/p8-sensitivity`; bugs get a failing test first.
- [ ] `git switch part-2 && git merge --no-ff nz/p8-sensitivity -m "merge: nz/p8-sensitivity into part-2"`. Ask before pushing.
