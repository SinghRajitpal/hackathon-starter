import { createPublicClient } from "@/lib/supabase/public";

import { buildDashboardModel } from "./engine/dashboard/model";
import { DEFAULT_ANSWERS } from "./engine/dashboard/presets";
import { loadScenarioDataFrom } from "./engine/load";
import type { ScenarioData } from "./engine/types";
import { buildNetZeroRanking, type NetZeroRankingRow } from "./ranking";

export type { NetZeroRankingRow } from "./ranking";
export type { ScenarioData } from "./engine/types";

export interface NetZeroResult {
  ticker: string;
  /** False when the ticker is not in the nz_company_inputs universe. */
  inUniverse: boolean;
  /** The whole universe: the company screen scores a ticker against its sector, in the browser. */
  data: ScenarioData;
}

const DATA_TTL_MS = 10 * 60_000;

interface Snapshot {
  loadedAt: number;
  data: Promise<ScenarioData>;
  ranking: NetZeroRankingRow[] | null;
}

let snapshot: Snapshot | null = null;

/** nz_* tables, reloaded at most every 10 minutes per server process. A failed load is not kept. */
export async function getNetZeroData(): Promise<ScenarioData> {
  if (!snapshot || Date.now() - snapshot.loadedAt > DATA_TTL_MS) {
    snapshot = { loadedAt: Date.now(), data: loadScenarioDataFrom(createPublicClient()), ranking: null };
  }
  const current = snapshot;
  const data = await current.data;
  if (data.error && snapshot === current) snapshot = null;
  return data;
}

export async function getNetZeroScenario(ticker: string): Promise<NetZeroResult> {
  const data = await getNetZeroData();
  const upper = ticker.trim().toUpperCase();
  return { ticker: upper, inUniverse: data.companies.some((c) => c.ticker === upper), data };
}

/** Balanced-preset ranking (the PDF defaults), memoised with the data snapshot. */
export async function getNetZeroRanking(): Promise<NetZeroRankingRow[]> {
  const data = await getNetZeroData();
  if (data.error) throw new Error(`net-zero data: ${data.error}`);
  const current = snapshot;
  if (current?.ranking) return current.ranking;
  const ranking = buildNetZeroRanking(data, buildDashboardModel(data, DEFAULT_ANSWERS));
  if (current) current.ranking = ranking;
  return ranking;
}
