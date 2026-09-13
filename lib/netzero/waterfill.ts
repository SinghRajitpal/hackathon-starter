export interface FillEntry {
  key: string;
  /** Relative preference; allocation is proportional to it. */
  pref: number;
  /** Maximum amount this key may receive. */
  cap: number;
}

/** Split `amount` across entries in proportion to `pref`, never above `cap`; excess flows to the others. */
export function waterfill(amount: number, entries: FillEntry[]): { alloc: Map<string, number>; leftover: number } {
  const alloc = new Map(entries.map((e) => [e.key, 0]));
  let remaining = amount;
  let open = entries.filter((e) => e.cap > 1e-15 && e.pref > 0);
  while (remaining > 1e-12 && open.length > 0) {
    const prefTotal = open.reduce((a, e) => a + e.pref, 0);
    let used = 0;
    const stillOpen: FillEntry[] = [];
    for (const e of open) {
      const room = e.cap - alloc.get(e.key)!;
      const give = Math.min((remaining * e.pref) / prefTotal, room);
      alloc.set(e.key, alloc.get(e.key)! + give);
      used += give;
      if (room - give > 1e-15) stillOpen.push(e);
    }
    remaining -= used;
    if (stillOpen.length === open.length) break;
    open = stillOpen;
  }
  return { alloc, leftover: Math.max(0, remaining) };
}
