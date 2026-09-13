import { createRateLimiter } from "@/features/netzero/explain/limits";
import { cacheKey, parseExplainRequest, resolvePacket } from "@/features/netzero/explain/request";
import { explainPacket } from "@/features/netzero/explain/service";
import { explainDeps, scenarioFor } from "@/features/netzero/server/explain";

/** Requests per client IP per minute. Cache hits are cheap; the limit stops loops from reaching Gemini. */
const allowRequest = createRateLimiter(Number(process.env.EXPLAIN_REQUESTS_PER_MINUTE ?? 120), 60_000);

/**
 * POST /api/explain { scope, key, context? }
 * The body names what to explain; every figure is rebuilt here from the engine, never taken from the client.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowRequest(ip)) return Response.json({ error: "too many requests" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }

  const parsed = parseExplainRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const scenario = await scenarioFor(parsed.context);
  if ("error" in scenario) return Response.json({ error: scenario.error }, { status: 503 });

  const packet = resolvePacket(parsed.target, scenario.data, scenario.model, new Date());
  if (!packet) return Response.json({ error: "unknown ticker or sector" }, { status: 404 });

  const response = await explainPacket(parsed.target.scope, cacheKey(parsed.target, parsed.context), packet, await explainDeps());
  return Response.json(response);
}
