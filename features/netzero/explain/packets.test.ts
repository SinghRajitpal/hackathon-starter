import { describe, expect, it } from "vitest";

import { buildMarketView } from "@/features/netzero/engine/dashboard/market";
import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import { syntheticUniverse } from "@/features/netzero/engine/fixtures";
import type { ScenarioData } from "@/features/netzero/engine/types";

import { buildCompanyPacket, buildMarketPacket, buildPortfolioPacket, buildSectorPacket, PACKET_SCHEMA_VERSION } from "./packets";
import { verdictForTicker } from "./verdict";

const data: ScenarioData = { companies: syntheticUniverse(), macRows: [], productMap: [], segments: [], validation: [], error: null };
const model = buildDashboardModel(data, DEFAULT_ANSWERS);
const now = new Date("2026-09-13T08:00:00.000Z");
const round2 = (v: number) => Math.round(v * 100) / 100;

function maxDecimals(value: unknown): number {
  if (typeof value === "number") {
    const s = String(value);
    return s.includes("e") ? 0 : (s.split(".")[1] ?? "").length;
  }
  if (Array.isArray(value)) return Math.max(0, ...value.map(maxDecimals));
  if (value !== null && typeof value === "object") return Math.max(0, ...Object.values(value).map(maxDecimals));
  return 0;
}

describe("evidence packets", () => {
  it("builds a company packet from the engine's own values", () => {
    const score = model.result.scores.get("ENE3")!;
    const p = buildCompanyPacket(data, model, "ENE3", now)!;
    expect(p).toMatchObject({
      schema_version: PACKET_SCHEMA_VERSION,
      generated_at: "2026-09-13T08:00:00.000Z",
      ticker: "ENE3",
      sector: "Energy",
      transition_bill_to_ebitda_years: round2(score.tbr),
      composite_score: round2(score.score),
      rank_in_sector: score.rank,
      sector_size: score.sectorSize,
      verdict_band: verdictForTicker(model, "ENE3")!.band,
    });
    expect(p.revenue_at_risk_pct).toBe(score.de === null ? null : round2(score.de * 100));
    expect(p.fossil_revenue_share_pct).toBe(p.revenue_at_risk_pct);
  });

  it("keeps missing values as null keys instead of dropping or zeroing them", () => {
    const withNulls = { ...data, companies: data.companies.map((c) => (c.ticker === "ENE4" ? { ...c, de: null, ben: null } : c)) };
    const m = buildDashboardModel(withNulls, DEFAULT_ANSWERS);
    const p = buildCompanyPacket(withNulls, m, "ENE4", now)!;
    expect(p).toHaveProperty("revenue_at_risk_pct", null);
    expect(p).toHaveProperty("revenue_upside_pct", null);
  });

  it("rounds every float in every packet to at most two decimals and states no EUR figure", () => {
    const packets = [
      buildCompanyPacket(data, model, "UTI5", now),
      buildSectorPacket(data, model, "Utilities", now),
      buildMarketPacket(data, model, now),
      buildPortfolioPacket(data, model, now),
    ];
    for (const p of packets) {
      expect(maxDecimals(p)).toBeLessThanOrEqual(2);
      expect(JSON.stringify(p).toLowerCase()).not.toContain("eur");
    }
  });

  it("returns null for an unknown ticker or sector", () => {
    expect(buildCompanyPacket(data, model, "NOPE", now)).toBeNull();
    expect(buildSectorPacket(data, model, "Nope", now)).toBeNull();
  });

  it("names the best and worst company by composite score and the sector's leaderboard position", () => {
    const p = buildSectorPacket(data, model, "Energy", now)!;
    const ranked = [...model.result.scores.values()].filter((s) => s.sector === "Energy").sort((a, b) => b.score - a.score);
    const rows = buildMarketView(data, model).rows;
    expect(p.best_ticker).toBe(ranked[0].ticker);
    expect(p.worst_ticker).toBe(ranked[ranked.length - 1].ticker);
    expect(p.leaderboard_rank).toBe(rows.findIndex((r) => r.sector === "Energy") + 1);
    expect(p.company_count).toBe(15);
  });

  it("lists every leaderboard row in the market packet", () => {
    const p = buildMarketPacket(data, model, now);
    const rows = buildMarketView(data, model).rows;
    expect(p.leaderboard.map((r) => r.sector)).toEqual(rows.map((r) => r.sector));
    expect(p.pickable_sector_count).toBe(rows.filter((r) => r.verdict === "pick-winners").length);
    expect(p.companies_covered).toBe(60);
  });

  it("describes a long-only book without shorts or exposures", () => {
    const p = buildPortfolioPacket(data, model, now);
    expect(p).toMatchObject({ risk_appetite_band: "up to 3%", shorting_allowed: false, long_short_book: false, top_shorts: null, gross_exposure_pct: null });
    expect(p.top_longs.length).toBeGreaterThan(0);
    expect(p.top_longs.every((r) => (r.active_weight_pp ?? 0) > 0)).toBe(true);
  });

  it("adds shorts and gross/net exposure when the aggressive preset allows shorting", () => {
    const m = buildDashboardModel(data, { ...DEFAULT_ANSWERS, trail: "high", allowShorts: true });
    const p = buildPortfolioPacket(data, m, now);
    expect(p.long_short_book).toBe(true);
    expect(p.gross_exposure_pct).toBe(round2(m.result.longShort.gross * 100));
    expect(p.top_shorts!.length).toBeGreaterThan(0);
  });
});
