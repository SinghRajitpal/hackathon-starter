import type { MacPoint } from "@/features/netzero/engine/config";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import type { DashboardModel, RiskAnswers, TrailTolerance } from "@/features/netzero/engine/dashboard/types";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { buildCompanyPacket, buildMarketPacket, buildPortfolioPacket, buildSectorPacket, type Packet } from "./packets";
import type { ExplainScope } from "./types";

/**
 * The client sends identifiers only: a ticker, a sector name, "market", or the portfolio answers,
 * plus the preset answers and cost scenario that pick which engine run to read. Any figures in the
 * body are ignored; the server rebuilds every value from its own engine run.
 */

export interface ExplainContext {
  answers: RiskAnswers;
  macPoint: MacPoint;
}

export type ExplainTarget =
  | { scope: "company"; ticker: string }
  | { scope: "sector"; sector: string }
  | { scope: "market" }
  | { scope: "portfolio" };

export type ParsedExplainRequest = { ok: true; target: ExplainTarget; context: ExplainContext } | { ok: false; error: string };

const TRAILS: readonly TrailTolerance[] = ["low", "medium", "high"];
const MAC_POINTS: readonly MacPoint[] = ["low", "mid", "high"];

function parseAnswers(value: unknown): RiskAnswers | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!TRAILS.includes(v.trail as TrailTolerance) || typeof v.allowShorts !== "boolean" || typeof v.robustOnly !== "boolean") {
    return null;
  }
  return { trail: v.trail as TrailTolerance, allowShorts: v.allowShorts, robustOnly: v.robustOnly };
}

export function parseExplainRequest(body: unknown): ParsedExplainRequest {
  if (body === null || typeof body !== "object") return { ok: false, error: "body must be a JSON object" };
  const { scope, key, context } = body as Record<string, unknown>;

  const rawContext = (context ?? {}) as Record<string, unknown>;
  const contextAnswers = rawContext.answers === undefined ? DEFAULT_ANSWERS : parseAnswers(rawContext.answers);
  const macPoint = rawContext.macPoint === undefined ? "mid" : (rawContext.macPoint as MacPoint);
  if (!contextAnswers || !MAC_POINTS.includes(macPoint)) return { ok: false, error: "invalid context" };

  switch (scope as ExplainScope) {
    case "company": {
      const ticker = typeof key === "string" ? key.trim().toUpperCase() : "";
      if (!/^[A-Z0-9.-]{1,12}$/.test(ticker)) return { ok: false, error: "key must be a ticker" };
      return { ok: true, target: { scope: "company", ticker }, context: { answers: contextAnswers, macPoint } };
    }
    case "sector": {
      const sector = typeof key === "string" ? key.trim() : "";
      if (sector.length === 0 || sector.length > 64) return { ok: false, error: "key must be a sector name" };
      return { ok: true, target: { scope: "sector", sector }, context: { answers: contextAnswers, macPoint } };
    }
    case "market":
      return { ok: true, target: { scope: "market" }, context: { answers: contextAnswers, macPoint } };
    case "portfolio": {
      const answers = parseAnswers(key);
      if (!answers) return { ok: false, error: "key must be the portfolio answers" };
      return { ok: true, target: { scope: "portfolio" }, context: { answers, macPoint } };
    }
    default:
      return { ok: false, error: "scope must be company, sector, market or portfolio" };
  }
}

/** The cache row's key column. */
export function cacheKey(target: ExplainTarget, context: ExplainContext): string {
  switch (target.scope) {
    case "company":
      return target.ticker;
    case "sector":
      return target.sector;
    case "market":
      return "market";
    case "portfolio": {
      const a = context.answers;
      return `trail=${a.trail}|shorts=${a.allowShorts}|robust=${a.robustOnly}`;
    }
  }
}

/** The request body the dashboard sends for a target. */
export function requestBody(target: ExplainTarget, context: ExplainContext): Record<string, unknown> {
  const key =
    target.scope === "company" ? target.ticker : target.scope === "sector" ? target.sector : target.scope === "portfolio" ? context.answers : "market";
  return { scope: target.scope, key, context };
}

export function resolvePacket(target: ExplainTarget, data: ScenarioData, model: DashboardModel, now: Date): Packet | null {
  switch (target.scope) {
    case "company":
      return buildCompanyPacket(data, model, target.ticker, now);
    case "sector":
      return buildSectorPacket(data, model, target.sector, now);
    case "market":
      return buildMarketPacket(data, model, now);
    case "portfolio":
      return buildPortfolioPacket(data, model, now);
  }
}
