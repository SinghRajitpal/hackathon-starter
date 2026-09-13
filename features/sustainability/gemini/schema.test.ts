import { describe, expect, it } from "vitest";
import { GeminiAnalysisSchema } from "./schema";

const VALID_ANALYSIS = {
  company_overview: {
    business: "Designs and sells semiconductors.",
    competitive_context: "Competes with a handful of large chipmakers.",
    strategic_context: "Demand is cyclical and capital-intensive.",
  },
  pillar_analysis: {
    environmental: "Environmental score reflects moderate emissions intensity.",
    social: "Social score reflects a mid-range ESG risk profile.",
    finance_operations: "Strong margins and low leverage support this pillar.",
  },
  overall_analysis: "Financial strength offsets a weaker environmental profile.",
  leaderboard_position: {
    rank: 3,
    total_companies: 500,
    explanation: "High financial score outweighs a middling environmental score.",
  },
  distance_to_ideal: {
    summary: "The company sits close to the model's ideal point.",
    key_drivers: "Most of the remaining gap comes from emissions intensity.",
  },
  sustainability_thesis: "The company ranks highly because of durable financials.",
  key_strengths: ["Low leverage", "High free cash flow margin"],
  key_weaknesses: ["Elevated emissions intensity relative to peers"],
  key_tradeoffs: ["Strong financial profile vs weaker environmental profile"],
};

describe("GeminiAnalysisSchema", () => {
  it("accepts a well-formed analysis", () => {
    const result = GeminiAnalysisSchema.safeParse(VALID_ANALYSIS);
    expect(result.success).toBe(true);
  });

  it("rejects a response missing a required section", () => {
    const missingOverview = { ...VALID_ANALYSIS };
    delete (missingOverview as Partial<typeof VALID_ANALYSIS>).company_overview;
    const result = GeminiAnalysisSchema.safeParse(missingOverview);
    expect(result.success).toBe(false);
  });

  it("rejects an empty-string field", () => {
    const invalid = { ...VALID_ANALYSIS, overall_analysis: "" };
    const result = GeminiAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer rank", () => {
    const invalid = {
      ...VALID_ANALYSIS,
      leaderboard_position: { ...VALID_ANALYSIS.leaderboard_position, rank: 3.5 },
    };
    const result = GeminiAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects an empty key_strengths array", () => {
    const invalid = { ...VALID_ANALYSIS, key_strengths: [] };
    const result = GeminiAnalysisSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects plain markdown/prose instead of the JSON object", () => {
    const result = GeminiAnalysisSchema.safeParse("This company ranks highly because...");
    expect(result.success).toBe(false);
  });
});
