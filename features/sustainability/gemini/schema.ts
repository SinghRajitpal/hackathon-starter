import { z } from "zod";

// Validates Gemini's JSON response against the structure required by
// GEMINI_SUSTAINABILITY_SYSTEM_PROMPT's "OUTPUT FORMAT" section. The
// frontend never has to deal with arbitrary Gemini text -- anything
// that doesn't parse against this schema is rejected server-side.
const nonEmptyString = z.string().trim().min(1);

export const GeminiAnalysisSchema = z.object({
  company_overview: z.object({
    business: nonEmptyString,
    competitive_context: nonEmptyString,
    strategic_context: nonEmptyString,
  }),
  pillar_analysis: z.object({
    environmental: nonEmptyString,
    social: nonEmptyString,
    finance_operations: nonEmptyString,
  }),
  overall_analysis: nonEmptyString,
  leaderboard_position: z.object({
    rank: z.number().int().positive(),
    total_companies: z.number().int().positive(),
    explanation: nonEmptyString,
  }),
  distance_to_ideal: z.object({
    summary: nonEmptyString,
    key_drivers: nonEmptyString,
  }),
  sustainability_thesis: nonEmptyString,
  key_strengths: z.array(nonEmptyString).min(1).max(5),
  key_weaknesses: z.array(nonEmptyString).min(1).max(5),
  key_tradeoffs: z.array(nonEmptyString).min(1).max(5),
});

export type GeminiAnalysis = z.infer<typeof GeminiAnalysisSchema>;
