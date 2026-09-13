import { describe, expect, it } from "vitest";

import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import type { ScenarioData } from "@/features/netzero/engine/types";

import type { CompanyPacket } from "./packets";
import { cacheKey, parseExplainRequest, requestBody, resolvePacket } from "./request";

const data: ScenarioData = { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
const now = new Date("2026-09-13T08:00:00.000Z");

describe("parseExplainRequest", () => {
  it("accepts a ticker and defaults the context to the Balanced preset at mid costs", () => {
    expect(parseExplainRequest({ scope: "company", key: " ene3 " })).toEqual({
      ok: true,
      target: { scope: "company", ticker: "ENE3" },
      context: { answers: DEFAULT_ANSWERS, macPoint: "mid" },
    });
  });

  it("ignores figures sent by the client and rebuilds them from the engine", () => {
    const parsed = parseExplainRequest({ scope: "company", key: "ENE3", composite_score: 999, packet: { composite_score: 999 } });
    if (!parsed.ok) throw new Error(parsed.error);
    const model = buildDashboardModel(data, parsed.context.answers);
    const packet = resolvePacket(parsed.target, data, model, now) as CompanyPacket;
    expect(packet.composite_score).toBe(Math.round(model.result.scores.get("ENE3")!.score * 100) / 100);
  });

  it("takes the portfolio answers from the key", () => {
    const answers = { trail: "high", allowShorts: true, robustOnly: false };
    const parsed = parseExplainRequest({ scope: "portfolio", key: answers, context: { macPoint: "low" } });
    expect(parsed).toEqual({ ok: true, target: { scope: "portfolio" }, context: { answers, macPoint: "low" } });
    if (parsed.ok) expect(cacheKey(parsed.target, parsed.context)).toBe("trail=high|shorts=true|robust=false");
  });

  it("rejects unknown scopes, malformed keys and invalid context", () => {
    expect(parseExplainRequest({ scope: "news", key: "x" }).ok).toBe(false);
    expect(parseExplainRequest({ scope: "company", key: "DROP TABLE" }).ok).toBe(false);
    expect(parseExplainRequest({ scope: "portfolio", key: { trail: "huge" } }).ok).toBe(false);
    expect(parseExplainRequest({ scope: "market", context: { macPoint: "extreme" } }).ok).toBe(false);
    expect(parseExplainRequest(null).ok).toBe(false);
  });

  it("round-trips the body the dashboard sends", () => {
    const context = { answers: { trail: "low" as const, allowShorts: false, robustOnly: true }, macPoint: "high" as const };
    for (const target of [
      { scope: "company" as const, ticker: "ENE3" },
      { scope: "sector" as const, sector: "Energy" },
      { scope: "market" as const },
      { scope: "portfolio" as const },
    ]) {
      expect(parseExplainRequest(JSON.parse(JSON.stringify(requestBody(target, context))))).toEqual({ ok: true, target, context });
    }
  });
});
