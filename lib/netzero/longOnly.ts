import type { SectorDispersion } from "./dispersion";
import type { CompanyScore } from "./scenario";
import { median } from "./stats";
import type { CompanyInput } from "./types";
import { waterfill } from "./waterfill";

/** PDF §9.2 limits as fractions of the portfolio. */
export const LO_LIMITS = { activeLimit: 0.02, nameMax: 0.05 };

export interface LoWeight {
  ticker: string;
  sector: string;
  benchmark: number;
  portfolio: number;
  active: number;
}

export interface LongOnlyBook {
  weights: Map<string, LoWeight>;
  sectorWeights: Map<string, { benchmark: number; portfolio: number }>;
  events: string[];
}

export function benchmarkWeights(companies: CompanyInput[]): Map<string, number> {
  const eligible = companies.filter((c) => c.floatCap !== null && c.floatCap > 0);
  const total = eligible.reduce((a, c) => a + (c.floatCap as number), 0);
  return new Map(eligible.map((c) => [c.ticker, (c.floatCap as number) / total]));
}

export interface TiltMember {
  ticker: string;
  score: number;
  benchmark: number;
}

/**
 * D15: bottom decile to zero, rest of bottom quintile cut by distance / max distance,
 * freed weight to top quintile by distance, clamps ±2pp active and 5% per name,
 * excess to middle names by benchmark weight, anything left returned to the bottom names.
 */
export function tiltSector(members: TiltMember[], limits = LO_LIMITS): { weights: Map<string, number>; events: string[] } {
  const events: string[] = [];
  const sorted = [...members].sort((a, b) => a.score - b.score);
  const n = sorted.length;
  let q = Math.ceil(n / 5);
  if (2 * q > n) q = Math.floor(n / 2);
  const d = Math.min(Math.ceil(n / 10), q);
  const med = median(sorted.map((m) => m.score));
  const distance = (m: TiltMember) => Math.abs(m.score - med);

  const bottom = sorted.slice(0, q);
  const top = sorted.slice(n - q);
  const inBottomOrTop = new Set([...bottom, ...top].map((m) => m.ticker));
  const middle = sorted.filter((m) => !inBottomOrTop.has(m.ticker));
  const maxBottomDistance = Math.max(0, ...bottom.map(distance));

  const cut = new Map<string, number>();
  bottom.forEach((m, i) => {
    let c = i < d ? m.benchmark : maxBottomDistance > 0 ? (m.benchmark * distance(m)) / maxBottomDistance : 0;
    if (c > limits.activeLimit) {
      events.push(`${m.ticker}: cut limited to ${(limits.activeLimit * 100).toFixed(0)}pp active`);
      c = limits.activeLimit;
    }
    cut.set(m.ticker, c);
  });
  const freed = [...cut.values()].reduce((a, b) => a + b, 0);
  const room = (m: TiltMember) => Math.max(0, Math.min(limits.activeLimit, limits.nameMax - m.benchmark));

  const topFill = waterfill(
    freed,
    top.map((m) => ({ key: m.ticker, pref: distance(m) > 0 ? distance(m) : m.benchmark, cap: room(m) })),
  );
  const middleFill = waterfill(
    topFill.leftover,
    middle.map((m) => ({ key: m.ticker, pref: m.benchmark, cap: room(m) })),
  );
  const giveBack = middleFill.leftover;
  if (giveBack > 1e-12 && freed > 0) {
    events.push(`${(giveBack * 100).toFixed(2)}% could not be placed within limits and was returned to the bottom quintile`);
    for (const m of bottom) cut.set(m.ticker, cut.get(m.ticker)! * (1 - giveBack / freed));
  }

  const weights = new Map<string, number>();
  for (const m of sorted) {
    const added = (topFill.alloc.get(m.ticker) ?? 0) + (middleFill.alloc.get(m.ticker) ?? 0);
    weights.set(m.ticker, m.benchmark - (cut.get(m.ticker) ?? 0) + added);
  }
  return { weights, events };
}

export function buildLongOnly(
  scores: Map<string, CompanyScore>,
  companies: CompanyInput[],
  dispersion: SectorDispersion[],
): LongOnlyBook {
  const events: string[] = [];
  const bench = benchmarkWeights(companies);
  const tradeable = new Set(dispersion.filter((d) => d.tradeable).map((d) => d.sector));
  const weights = new Map<string, LoWeight>();

  for (const c of companies) {
    const b = bench.get(c.ticker);
    if (b === undefined) continue;
    weights.set(c.ticker, { ticker: c.ticker, sector: c.sector, benchmark: b, portfolio: b, active: 0 });
    if (b > LO_LIMITS.nameMax) {
      events.push(`${c.ticker}: benchmark weight ${(b * 100).toFixed(2)}% above 5% cap kept to hold sector weight`);
    }
  }

  for (const sector of tradeable) {
    const members: TiltMember[] = [];
    for (const w of weights.values()) {
      const s = scores.get(w.ticker);
      if (w.sector === sector && s) members.push({ ticker: w.ticker, score: s.score, benchmark: w.benchmark });
    }
    if (members.length < 2) continue;
    const tilt = tiltSector(members);
    events.push(...tilt.events.map((e) => `${sector}: ${e}`));
    for (const [ticker, portfolio] of tilt.weights) {
      const w = weights.get(ticker)!;
      weights.set(ticker, { ...w, portfolio, active: portfolio - w.benchmark });
    }
  }

  const sectorWeights = new Map<string, { benchmark: number; portfolio: number }>();
  for (const w of weights.values()) {
    const s = sectorWeights.get(w.sector) ?? { benchmark: 0, portfolio: 0 };
    sectorWeights.set(w.sector, { benchmark: s.benchmark + w.benchmark, portfolio: s.portfolio + w.portfolio });
  }
  return { weights, sectorWeights, events };
}
