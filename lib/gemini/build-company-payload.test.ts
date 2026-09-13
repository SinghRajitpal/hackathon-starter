import { describe, expect, it } from "vitest";
import { buildCompanyPayload, type ScoreRowWithDistance } from "./build-company-payload";

const FAKE_ROW: ScoreRowWithDistance = {
  ticker: "NVDA",
  company_name: "Nvidia",
  sector: "Information Technology",
  score: 63.6,
  rank: 10,
  sector_rank: 4,
  percentile_index: 98.2,
  percentile_sector: 95.0,
  pillar_environmental_score: 70.1,
  pillar_social_score: 55.4,
  pillar_financial_score: 68.9,
  d_plus: 0.184,

  weight_env_intensity: 0.2398,
  weight_esg_risk: 0.1484,
  weight_controversy: 0.0818,
  weight_asset_turnover: 0.1657,
  weight_profit_margin: 0.074,
  weight_fcf_margin: 0.1872,
  weight_leverage: 0.1031,

  contrib_env_intensity: 0.3,
  contrib_esg_risk: 0.15,
  contrib_controversy: 0.05,
  contrib_asset_turnover: 0.2,
  contrib_profit_margin: 0.1,
  contrib_fcf_margin: 0.15,
  contrib_leverage: 0.05,

  env_intensity_raw: 12.4,
  esg_risk_raw: 18.2,
  controversy_raw: 1,
  asset_turnover_raw: 0.55,
  profit_margin_raw: 0.32,
  fcf_margin_raw: 0.28,
  leverage_raw: -0.9,
};

describe("buildCompanyPayload", () => {
  it("maps identifiers, rank, and total_companies straight through", () => {
    const payload = buildCompanyPayload(FAKE_ROW, 500);
    expect(payload.company).toBe("Nvidia");
    expect(payload.ticker).toBe("NVDA");
    expect(payload.sector).toBe("Information Technology");
    expect(payload.rank).toBe(10);
    expect(payload.total_companies).toBe(500);
  });

  it("maps the overall and pillar scores from the row, unmodified", () => {
    const payload = buildCompanyPayload(FAKE_ROW, 500);
    expect(payload.overall_score).toBe(63.6);
    expect(payload.environmental_score).toBe(70.1);
    expect(payload.social_score).toBe(55.4);
    expect(payload.finance_operations_score).toBe(68.9);
    expect(payload.distance_to_ideal).toBe(0.184);
  });

  it("includes one decomposition entry per variable, summing close to 1", () => {
    const payload = buildCompanyPayload(FAKE_ROW, 500);
    const values = Object.values(payload.distance_to_ideal_decomposition);
    expect(values).toHaveLength(7);
    const sum = values.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("includes raw value, unit, direction, source, weight, and contribution per variable", () => {
    const payload = buildCompanyPayload(FAKE_ROW, 500);
    const emissions = payload.variables["Emissions intensity"];
    expect(emissions.value).toBe(12.4);
    expect(emissions.direction).toBe("cost");
    expect(emissions.weight).toBeCloseTo(0.2398, 4);
    expect(emissions.contribution_to_distance).toBeCloseTo(0.3, 4);
    expect(typeof emissions.unit).toBe("string");
    expect(typeof emissions.source).toBe("string");
  });

  it("never includes an imputed flag or any internal-only field", () => {
    const payload = buildCompanyPayload(FAKE_ROW, 500);
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain("imputed");
  });
});
