import type { GeminiAnalysis } from "./schema";

/**
 * Hand-written analyses in the same shape and voice as Gemini's output, served
 * by /api/sustainability-analysis before any cache or Gemini call. Every
 * number is taken from the company's sp500_esg_scores row (13 Sep 2026 run);
 * update the text if that row changes.
 */
export const HARDCODED_ANALYSES: Partial<Record<string, GeminiAnalysis>> = {
  XOM: {
    sustainability_thesis:
      "ExxonMobil illustrates how an integrated oil and gas model can pair solid cash generation with structurally weak sustainability performance. A heavy operational carbon footprint and a high unmanaged ESG risk score are the two largest drags on its profile, placing it #436 overall and 15th of 21 in Energy. A conservative balance sheet and positive margins keep it out of the index's bottom tier, but its ranking reflects a business whose core revenue is still tied directly to hydrocarbon production and processing.",
    company_overview: {
      business:
        "ExxonMobil explores for, produces and refines crude oil and natural gas, and manufactures fuels, lubricants and petrochemical products sold worldwide.",
      competitive_context:
        "The company competes as one of the largest integrated energy majors, spanning upstream production, downstream refining and chemicals, where scale and cost discipline matter more than product differentiation.",
      strategic_context:
        "ExxonMobil's business model keeps capital-intensive extraction and processing assets in-house, which drives its large emissions footprint and heavy asset base while its Low Carbon Solutions unit remains small relative to core operations.",
    },
    pillar_analysis: {
      environmental:
        "ExxonMobil records an Environmental score of 29.15, driven by a high emissions intensity of 165.61 tCO2e per million USD revenue. As an operator of upstream production, refineries and chemical plants, its direct Scope 1 and Scope 2 emissions scale with physical throughput rather than with revenue. This leaves its carbon efficiency far from the model's ideal, and emissions intensity alone accounts for 27% of its distance to the ideal company.",
      social:
        "The Social score of 21.34 is the weakest of the three pillars, weighed down by a high unmanaged ESG Risk Score of 41.6 and a Controversy Level of 3. Exposure to spills, community and climate-related litigation, and scrutiny over transition strategy keep its risk profile elevated. The ESG risk score is the single largest source of distance from the ideal, at 34% of the total.",
      finance_operations:
        "ExxonMobil earns a Finance & Operations score of 52.55, its strongest pillar, anchored by a conservative balance sheet with a Net Debt to EBITDA ratio of 1.12 that sits at the model's ideal. A net margin of 12.68% and a free cash flow margin of 14.87% are healthy for the sector. However, an asset turnover ratio of 0.25 reflects a very large asset base relative to revenue, which holds the pillar back from the top tier.",
    },
    overall_analysis:
      "ExxonMobil's overall score of 40.78 combines weak environmental and social profiles with moderate financial strength. Its financial resilience, especially low leverage and steady cash conversion, prevents a lower ranking, but a heavy carbon footprint and high unmanaged ESG risk dominate the result and place it in the 13th percentile of the index and the 30th percentile of Energy.",
    leaderboard_position: {
      rank: 436,
      total_companies: 503,
      explanation:
        "ExxonMobil's #436 ranking reflects how far its emissions intensity and ESG risk exposure sit from the benchmark set by lower-carbon sectors. Within Energy it ranks 15th of 21: peers such as EOG and ConocoPhillips run far lower emissions intensities (21.16 and 29.50 tCO2e per million USD revenue), while Valero carries a similar carbon footprint but a lower ESG Risk Score of 32.6. It stays above the index's bottom tier because its balance sheet and cash generation remain solid.",
    },
    distance_to_ideal: {
      summary:
        "ExxonMobil records a high Distance to Ideal of 0.6646, meaning its overall multi-dimensional coordinate sits well away from the model's optimal target.",
      key_drivers:
        "The primary sources of distance from the ideal company are ESG risk score (contributing 0.3359 to total distance) and emissions intensity (0.2725), followed by asset turnover (0.1391) and free cash flow margin (0.1357). Conversely, Net Debt to EBITDA contributes effectively zero distance (0.0000), having fully satisfied the ideal requirement.",
    },
    key_strengths: [
      "Conservative balance sheet with a Net Debt to EBITDA ratio of 1.12, sitting at the model's ideal for leverage.",
      "Positive net margin of 12.68% and free cash flow margin of 14.87%, providing financial capacity for transition spending.",
      "Moderate Controversy Level of 3, contributing only 7% of total distance to ideal.",
    ],
    key_weaknesses: [
      "High emissions intensity of 165.61 tCO2e per million USD revenue, accounting for 27% of distance to ideal.",
      "Elevated unmanaged ESG Risk Score of 41.6, the single largest source of distance at 34%.",
      "Low asset turnover ratio of 0.25 reflecting a capital-heavy asset base relative to revenue.",
    ],
    key_tradeoffs: [
      "Owning extraction, refining and chemical assets secures margins and cash flow across the value chain but locks in direct Scope 1 and 2 emissions.",
      "A strong balance sheet creates capacity for low-carbon investment, yet capital allocation still favours core oil and gas production that keeps environmental and ESG risk scores weak.",
    ],
  },
};
