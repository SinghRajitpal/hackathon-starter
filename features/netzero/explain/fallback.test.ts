import { describe, expect, it } from "vitest";

import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import type { RiskAnswers } from "@/features/netzero/engine/dashboard/types";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { fallbackExplanation } from "./fallback";
import { validateGrounding } from "./grounding";
import { buildCompanyPacket, buildMarketPacket, buildPortfolioPacket, buildSectorPacket, type CompanyPacket, type Packet } from "./packets";
import { matchesSchema } from "./schemas";
import type { CompanyExplanation } from "./types";

const data: ScenarioData = { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
const now = new Date("2026-09-13T08:00:00.000Z");

function expectValid(packet: Packet) {
  const payload = fallbackExplanation(packet);
  expect(matchesSchema(packet.scope, payload), JSON.stringify(payload)).toBe(true);
  expect(validateGrounding(payload, packet), JSON.stringify(payload)).toEqual({ ok: true, unmatched: [] });
}

describe("fallbackExplanation", () => {
  const answerSets: RiskAnswers[] = [
    DEFAULT_ANSWERS,
    { trail: "low", allowShorts: false, robustOnly: true },
    { trail: "high", allowShorts: true, robustOnly: false },
  ];

  it("is well-formed and grounded for every company, sector, market and portfolio packet", () => {
    for (const answers of answerSets) {
      const model = buildDashboardModel(data, answers);
      for (const c of data.companies) expectValid(buildCompanyPacket(data, model, c.ticker, now)!);
      for (const s of new Set(data.companies.map((c) => c.sector))) expectValid(buildSectorPacket(data, model, s, now)!);
      expectValid(buildMarketPacket(data, model, now));
      expectValid(buildPortfolioPacket(data, model, now));
    }
  });

  it("copies the computed verdict band", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    for (const c of data.companies) {
      const packet = buildCompanyPacket(data, model, c.ticker, now)!;
      expect((fallbackExplanation(packet) as CompanyExplanation).verdict).toBe(packet.verdict_band);
    }
  });

  it("names fields the tool did not compute instead of inventing values", () => {
    const model = buildDashboardModel(data, DEFAULT_ANSWERS);
    const packet: CompanyPacket = { ...buildCompanyPacket(data, model, "ENE5", now)!, cleanup_cost_usd_m: null, revenue_at_risk_pct: null };
    const payload = fallbackExplanation(packet) as CompanyExplanation;
    expect(payload.caveat).toBe("The tool did not compute cleanup cost in USD, revenue at risk.");
    expect(payload.key_drivers).toContain("The tool did not compute revenue at risk");
  });
});
