import { LO_LIMITS, type LongOnlyBook, type LongOnlyLimits, type LoWeight } from "@/lib/netzero/longOnly";
import { groupBySector } from "@/lib/netzero/scenario";
import { waterfill } from "@/lib/netzero/waterfill";

/**
 * PDF §8/§9 robust-only filter: names in `nonRobust` are held at benchmark (active = 0).
 * The active weight freed by neutralising them is redistributed, sector by sector, to the
 * remaining (robust) names in proportion to benchmark weight, capped so no active exceeds
 * `limits.activeLimit`; whatever cannot be placed within that limit is returned to benchmark
 * (left unallocated) rather than breaching it. Either way every sector's total portfolio
 * weight still equals its total benchmark weight, exactly as before neutralisation.
 */
export function neutraliseLongOnly(book: LongOnlyBook, nonRobust: Set<string>, limits: LongOnlyLimits = LO_LIMITS): LongOnlyBook {
  const weights = new Map(book.weights);
  for (const [, members] of groupBySector([...book.weights.values()])) {
    let removed = 0;
    for (const w of members) {
      if (!nonRobust.has(w.ticker)) continue;
      removed += w.active;
      weights.set(w.ticker, { ...w, active: 0, portfolio: w.benchmark } satisfies LoWeight);
    }
    if (Math.abs(removed) < 1e-12) continue;

    const direction = Math.sign(removed);
    const candidates = members.filter((w) => !nonRobust.has(w.ticker));
    const room = (w: LoWeight) => Math.max(0, limits.activeLimit - Math.max(0, direction * w.active));
    const fill = waterfill(
      Math.abs(removed),
      candidates.map((w) => ({ key: w.ticker, pref: w.benchmark, cap: room(w) })),
    );
    for (const w of candidates) {
      const added = fill.alloc.get(w.ticker) ?? 0;
      if (added === 0) continue;
      const active = w.active + direction * added;
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
