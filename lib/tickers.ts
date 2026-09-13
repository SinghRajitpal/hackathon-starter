export type TickerOption = { ticker: string; company_name: string };

export type RankingView = "sustainability" | "netzero" | "both";

const RANKING_VIEWS: readonly string[] = ["sustainability", "netzero", "both"];

/** Reads `?ranking=` on /tickers; anything unexpected means no ranking is chosen. */
export function parseRankingView(value: string | string[] | undefined): RankingView | null {
  return typeof value === "string" && RANKING_VIEWS.includes(value) ? (value as RankingView) : null;
}

/**
 * Search suggestions: the exact ticker, then tickers starting with the query, then company names
 * starting with it, then any other ticker or name match.
 */
export function matchTickers<T extends TickerOption>(options: T[], query: string, limit = 8): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact: T[] = [];
  const prefix: T[] = [];
  const namePrefix: T[] = [];
  const contains: T[] = [];
  for (const option of options) {
    const ticker = option.ticker.toLowerCase();
    const name = option.company_name.toLowerCase();
    if (ticker === q) exact.push(option);
    else if (ticker.startsWith(q)) prefix.push(option);
    else if (name.startsWith(q)) namePrefix.push(option);
    else if (ticker.includes(q) || name.includes(q)) contains.push(option);
  }
  return [...exact, ...prefix, ...namePrefix, ...contains].slice(0, limit);
}

/** Tickers grouped by first letter, A to Z, sorted inside each group. */
export function groupByLetter<T extends { ticker: string }>(items: T[]): { letter: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of [...items].sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    const letter = item.ticker[0].toUpperCase();
    const group = groups.get(letter);
    if (group) group.push(item);
    else groups.set(letter, [item]);
  }
  return [...groups].map(([letter, groupItems]) => ({ letter, items: groupItems }));
}
