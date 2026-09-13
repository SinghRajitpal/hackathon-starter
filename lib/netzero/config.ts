import {
  CATEGORIES,
  DEFAULT_CAPITAL,
  DEFAULT_OPTIONS,
  DEFAULT_SCORE_IQR_THRESHOLD,
  DEFAULT_TBR_IQR_THRESHOLD,
  type Category,
  type MacRow,
  type MacVector,
  type ScenarioConfig,
} from "./types";

export type MacPoint = "low" | "mid" | "high";

/** PDF §12 mid-points; used only when a category is missing from nz_mac_costs. */
export const FALLBACK_MID_MAC: MacVector = { scope2: 30, combustion: 120, fleet: 200, process: 150, fugitive: 15 };

export function macVector(rows: MacRow[], point: MacPoint = "mid"): { mac: MacVector; missing: Category[] } {
  const byCategory = new Map(rows.map((r) => [r.category, r]));
  const missing: Category[] = [];
  const mac = Object.fromEntries(
    CATEGORIES.map((c) => {
      const row = byCategory.get(c);
      if (!row) {
        missing.push(c);
        return [c, FALLBACK_MID_MAC[c]];
      }
      return [c, row[point]];
    }),
  ) as MacVector;
  return { mac, missing };
}

export function defaultConfig(mac: MacVector): ScenarioConfig {
  return {
    mac,
    tbrIqrThreshold: DEFAULT_TBR_IQR_THRESHOLD,
    scoreIqrThreshold: DEFAULT_SCORE_IQR_THRESHOLD,
    capital: DEFAULT_CAPITAL,
    mandate: "long-only",
    options: DEFAULT_OPTIONS,
  };
}
