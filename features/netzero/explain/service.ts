import { createHash } from "node:crypto";

import { fallbackExplanation } from "./fallback";
import { EXPLAIN_MODEL, explain, type ExplainDeps, type GenerateFn } from "./gemini";
import { GROUNDING_RULES_VERSION } from "./grounding";
import type { Packet } from "./packets";
import { SYSTEM_INSTRUCTION } from "./prompt";
import { RESPONSE_SCHEMAS } from "./schemas";
import type { ExplainResponse, ExplainScope, ExplanationPayload, FallbackReason } from "./types";

export interface CachedExplanation {
  payload: ExplanationPayload;
  model: string;
}

export interface CacheRow extends CachedExplanation {
  scope: ExplainScope;
  key: string;
  input_hash: string;
}

export interface ExplanationCache {
  get(scope: ExplainScope, key: string, inputHash: string): Promise<CachedExplanation | null>;
  put(row: CacheRow): Promise<void>;
}

/** How long a failure suppresses new Gemini calls. A rate limit pauses every packet; other failures pause only theirs. */
export const FAILURE_COOLDOWN_MS: Record<FallbackReason, number> = {
  "rate-limited": 5 * 60_000,
  timeout: 60_000,
  "gemini-error": 60_000,
  "invalid-output": 60 * 60_000,
  ungrounded: 60 * 60_000,
  "no-key": 0,
  "no-packet": 0,
};

/** Process-local state that stops duplicate and repeated Gemini calls. */
export interface ExplainMemory {
  inflight: Map<string, Promise<ExplainResponse>>;
  failures: Map<string, { until: number; reason: FallbackReason }>;
  quietUntil: number;
}

export function createExplainMemory(): ExplainMemory {
  return { inflight: new Map(), failures: new Map(), quietUntil: 0 };
}

export interface ExplainServiceDeps {
  cache: ExplanationCache | null;
  /** null when no API key could be resolved. */
  generate: GenerateFn | null;
  log(event: string, detail: Record<string, unknown>): void;
  memory?: ExplainMemory;
  now?: () => number;
  sleep?: ExplainDeps["sleep"];
  random?: ExplainDeps["random"];
}

/** Changes whenever the model, prompt, schemas or grounding rules change, so old cached text is not served. */
export const EXPLAIN_VERSION = createHash("sha256")
  .update(JSON.stringify([EXPLAIN_MODEL, SYSTEM_INSTRUCTION, RESPONSE_SCHEMAS, GROUNDING_RULES_VERSION]))
  .digest("hex")
  .slice(0, 16);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** SHA-256 of the canonicalised packet plus the explanation version. generated_at is excluded. */
export function packetHash(packet: Packet, version: string = EXPLAIN_VERSION): string {
  const { generated_at: _generatedAt, ...stable } = packet;
  void _generatedAt;
  return createHash("sha256")
    .update(JSON.stringify(canonical({ version, packet: stable })))
    .digest("hex");
}

/**
 * Cache first, then Gemini (written through on success), otherwise the deterministic fallback.
 * With memory: identical concurrent requests share one Gemini call, and recent failures fall back
 * without calling Gemini again until their cooldown ends.
 */
export async function explainPacket(scope: ExplainScope, key: string, packet: Packet, deps: ExplainServiceDeps): Promise<ExplainResponse> {
  const inputHash = packetHash(packet);

  if (deps.cache) {
    try {
      const hit = await deps.cache.get(scope, key, inputHash);
      if (hit) return { scope, key, source: "cache", fallbackReason: null, model: hit.model, explanation: hit.payload };
    } catch (e) {
      deps.log("explain cache read failed", { scope, key, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const fallback = (reason: FallbackReason): ExplainResponse => ({
    scope,
    key,
    source: "fallback",
    fallbackReason: reason,
    model: null,
    explanation: fallbackExplanation(packet),
  });

  const generate = deps.generate;
  if (!generate) return fallback("no-key");

  const now = deps.now ?? Date.now;
  const memory = deps.memory;
  const id = `${scope}|${key}|${inputHash}`;
  if (memory) {
    if (now() < memory.quietUntil) return fallback("rate-limited");
    const failure = memory.failures.get(id);
    if (failure && now() < failure.until) return fallback(failure.reason);
    const running = memory.inflight.get(id);
    if (running) return running;
  }

  const run = (async (): Promise<ExplainResponse> => {
    const outcome = await explain(scope, packet, { generate, sleep: deps.sleep, random: deps.random });
    if (!outcome.ok) {
      deps.log("explain fell back", { scope, key, reason: outcome.reason, discarded: outcome.discarded });
      if (memory) {
        const until = now() + FAILURE_COOLDOWN_MS[outcome.reason];
        if (outcome.reason === "rate-limited") memory.quietUntil = until;
        else memory.failures.set(id, { until, reason: outcome.reason });
      }
      return fallback(outcome.reason);
    }

    memory?.failures.delete(id);
    if (deps.cache) {
      try {
        await deps.cache.put({ scope, key, input_hash: inputHash, payload: outcome.payload, model: EXPLAIN_MODEL });
      } catch (e) {
        deps.log("explain cache write failed", { scope, key, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { scope, key, source: "gemini", fallbackReason: null, model: EXPLAIN_MODEL, explanation: outcome.payload };
  })();

  if (memory) {
    memory.inflight.set(id, run);
    const clear = () => memory.inflight.delete(id);
    run.then(clear, clear);
  }
  return run;
}
