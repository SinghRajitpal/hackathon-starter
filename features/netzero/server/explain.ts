import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GenerateFn } from "@/features/netzero/explain/gemini";
import { budgetedGenerate } from "@/features/netzero/explain/limits";
import type { ExplainContext } from "@/features/netzero/explain/request";
import { createExplainMemory, type ExplanationCache, type ExplainServiceDeps } from "@/features/netzero/explain/service";
import { buildDashboardModel, DEFAULT_ADJUST } from "@/features/netzero/engine/dashboard/model";
import type { DashboardModel } from "@/features/netzero/engine/dashboard/types";
import { loadScenarioDataFrom } from "@/features/netzero/engine/load";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { googleGenerate } from "./gemini-client";
import { getGeminiApiKey, invalidateGeminiApiKey } from "./secrets";
import { createAdminClient } from "./supabase-admin";

const DATA_TTL_MS = 10 * 60_000;
/** Most Gemini calls one server process makes per UTC day; beyond it, uncached tabs show the fallback. */
const DAILY_GEMINI_CALLS = Number(process.env.EXPLAIN_GEMINI_DAILY_CAP ?? 1000);

interface Snapshot {
  loadedAt: number;
  data: Promise<ScenarioData>;
  models: Map<string, DashboardModel>;
}

let snapshot: Snapshot | null = null;
const memory = createExplainMemory();
let generator: { apiKey: string; generate: GenerateFn } | null = null;

/**
 * The same engine run the dashboard makes for these answers and cost scenario, built from the nz_*
 * tables on the server. Data is reloaded every 10 minutes; models are memoised per context.
 */
export async function scenarioFor(context: ExplainContext): Promise<{ data: ScenarioData; model: DashboardModel } | { error: string }> {
  if (!snapshot || Date.now() - snapshot.loadedAt > DATA_TTL_MS) {
    const admin = createAdminClient();
    if (!admin) return { error: "explanations are not configured on this server" };
    snapshot = { loadedAt: Date.now(), data: loadScenarioDataFrom(admin), models: new Map() };
  }
  const current = snapshot;
  const data = await current.data;
  if (data.error) {
    if (snapshot === current) snapshot = null;
    return { error: "scenario data unavailable" };
  }

  const { trail, allowShorts, robustOnly } = context.answers;
  const id = `${trail}|${allowShorts}|${robustOnly}|${context.macPoint}`;
  let model = current.models.get(id);
  if (!model) {
    model = buildDashboardModel(data, context.answers, { ...DEFAULT_ADJUST, macPoint: context.macPoint });
    current.models.set(id, model);
  }
  return { data, model };
}

function supabaseCache(admin: SupabaseClient): ExplanationCache {
  return {
    async get(scope, key, inputHash) {
      const { data, error } = await admin
        .from("nz_explanations")
        .select("payload, model")
        .eq("scope", scope)
        .eq("key", key)
        .eq("input_hash", inputHash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { payload: data.payload, model: data.model } : null;
    },
    async put(row) {
      const { error } = await admin.from("nz_explanations").upsert(row, { onConflict: "scope,key,input_hash" });
      if (error) throw new Error(error.message);
    },
  };
}

/** One budgeted Gemini client per key, kept across requests so the daily cap holds for the process. */
function generatorFor(apiKey: string): GenerateFn {
  if (!generator || generator.apiKey !== apiKey) {
    const onAuthError = () => {
      invalidateGeminiApiKey();
      generator = null;
    };
    generator = { apiKey, generate: budgetedGenerate(googleGenerate(apiKey, { onAuthError }), DAILY_GEMINI_CALLS) };
  }
  return generator.generate;
}

export async function explainDeps(): Promise<ExplainServiceDeps> {
  const admin = createAdminClient();
  const apiKey = await getGeminiApiKey();
  return {
    cache: admin ? supabaseCache(admin) : null,
    generate: apiKey ? generatorFor(apiKey) : null,
    memory,
    log: (event, detail) => console.warn(JSON.stringify({ event, ...detail })),
  };
}
