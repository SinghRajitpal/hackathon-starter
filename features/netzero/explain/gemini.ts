import { validateGrounding } from "./grounding";
import type { Packet } from "./packets";
import { buildUserMessage, SYSTEM_INSTRUCTION } from "./prompt";
import { matchesSchema, RESPONSE_SCHEMAS } from "./schemas";
import type { ExplainScope, ExplanationPayload, FallbackReason } from "./types";

/** gemini-2.5-flash returns 404 for new API keys; Google's error names gemini-3.6-flash as the replacement. */
export const EXPLAIN_MODEL = "gemini-3.6-flash";

export interface GenerateRequest {
  model: string;
  systemInstruction: string;
  userMessage: string;
  responseSchema: Record<string, unknown>;
}

/** The network boundary: one Gemini call, returning the response text. */
export type GenerateFn = (request: GenerateRequest) => Promise<string>;

/** status: HTTP status, or "timeout" / "network" when no response arrived. */
export class GenerateError extends Error {
  constructor(
    readonly status: number | "timeout" | "network",
    message = `Gemini request failed (${status})`,
  ) {
    super(message);
    this.name = "GenerateError";
  }
}

export interface ExplainDeps {
  generate: GenerateFn;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

export type ExplainOutcome =
  | { ok: true; payload: ExplanationPayload }
  | { ok: false; reason: FallbackReason; discarded: string[] };

const retryable = (e: unknown) => e instanceof GenerateError && (e.status === 429 || (typeof e.status === "number" && e.status >= 500));

function failureReason(e: unknown): FallbackReason {
  if (e instanceof GenerateError) {
    if (e.status === 429) return "rate-limited";
    if (e.status === "timeout") return "timeout";
  }
  return "gemini-error";
}

async function generateWithRetry(request: GenerateRequest, deps: ExplainDeps): Promise<string> {
  try {
    return await deps.generate(request);
  } catch (e) {
    if (!retryable(e)) throw e;
    const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    await sleep(1000 + Math.floor((deps.random ?? Math.random)() * 1000));
    return deps.generate(request);
  }
}

/**
 * One explanation for one packet: a closed-packet call, a structural check, then the grounding check.
 * An ungrounded answer gets one regeneration with the correction line; anything still invalid is
 * discarded so the caller can fall back.
 */
export async function explain(scope: ExplainScope, packet: Packet, deps: ExplainDeps): Promise<ExplainOutcome> {
  const discarded: string[] = [];
  let reason: FallbackReason = "invalid-output";
  let groundingRetry = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string;
    try {
      text = await generateWithRetry(
        {
          model: EXPLAIN_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          userMessage: buildUserMessage(scope, packet, groundingRetry),
          responseSchema: RESPONSE_SCHEMAS[scope],
        },
        deps,
      );
    } catch (e) {
      return { ok: false, reason: failureReason(e), discarded };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      discarded.push(text);
      reason = "invalid-output";
      continue;
    }

    const wellFormed =
      matchesSchema(scope, parsed) && (packet.scope !== "company" || (parsed as { verdict: unknown }).verdict === packet.verdict_band);
    if (!wellFormed) {
      discarded.push(text);
      reason = "invalid-output";
      continue;
    }

    if (!validateGrounding(parsed, packet).ok) {
      discarded.push(text);
      reason = "ungrounded";
      groundingRetry = true;
      continue;
    }

    return { ok: true, payload: parsed as ExplanationPayload };
  }

  return { ok: false, reason, discarded };
}
