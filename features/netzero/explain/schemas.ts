import type { ExplainScope, ExplanationByScope, VerdictBand } from "./types";

/** Gemini responseSchema objects (OpenAPI subset). propertyOrdering puts evidence before conclusions. */

const text = (description: string) => ({ type: "STRING", description });
const list = (description: string, min: number, max: number) => ({
  type: "ARRAY",
  items: text(description),
  minItems: String(min),
  maxItems: String(max),
});

export const VERDICT_BANDS: readonly VerdictBand[] = ["BUY", "HOLD", "SELL"];

export const RESPONSE_SCHEMAS: Record<ExplainScope, Record<string, unknown>> = {
  company: {
    type: "OBJECT",
    properties: {
      key_drivers: list("One driver, at most 15 words", 3, 3),
      rationale: text("At most 60 words"),
      caveat: text('At most 25 words: what the numbers do not capture, or "" if nothing material'),
      verdict_line: text("At most 20 words: the one-sentence justification"),
      verdict: { type: "STRING", format: "enum", enum: [...VERDICT_BANDS] },
    },
    required: ["key_drivers", "rationale", "caveat", "verdict_line", "verdict"],
    propertyOrdering: ["key_drivers", "rationale", "caveat", "verdict_line", "verdict"],
  },
  sector: {
    type: "OBJECT",
    properties: {
      takeaways: list("One takeaway, at most 20 words", 3, 3),
      pickability: text("At most 30 words: whether the winner-loser gap justifies single-stock selection"),
      headline: text("At most 15 words"),
    },
    required: ["takeaways", "pickability", "headline"],
    propertyOrdering: ["takeaways", "pickability", "headline"],
  },
  market: {
    type: "OBJECT",
    properties: {
      heaviest_hit: list("One sector, at most 20 words", 2, 3),
      least_affected: list("One sector, at most 20 words", 2, 3),
      where_to_pick: text("At most 40 words"),
      headline: text("At most 15 words"),
    },
    required: ["heaviest_hit", "least_affected", "where_to_pick", "headline"],
    propertyOrdering: ["heaviest_hit", "least_affected", "where_to_pick", "headline"],
  },
  portfolio: {
    type: "OBJECT",
    properties: {
      long_thesis: text("At most 45 words"),
      short_thesis: text("At most 45 words, or a note that shorting is disabled"),
      risk_note: text("At most 30 words"),
      headline: text("At most 15 words"),
    },
    required: ["long_thesis", "short_thesis", "risk_note", "headline"],
    propertyOrdering: ["long_thesis", "short_thesis", "risk_note", "headline"],
  },
};

const isString = (v: unknown): v is string => typeof v === "string";
const isStringList = (v: unknown, min: number, max: number) =>
  Array.isArray(v) && v.length >= min && v.length <= max && v.every(isString);

/** Structural check of a parsed response; word limits are left to the prompt. */
export function matchesSchema<S extends ExplainScope>(scope: S, value: unknown): value is ExplanationByScope[S] {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  switch (scope) {
    case "company":
      return (
        VERDICT_BANDS.includes(v.verdict as VerdictBand) &&
        isString(v.verdict_line) &&
        isStringList(v.key_drivers, 3, 3) &&
        isString(v.rationale) &&
        isString(v.caveat)
      );
    case "sector":
      return isString(v.headline) && isStringList(v.takeaways, 3, 3) && isString(v.pickability);
    case "market":
      return isString(v.headline) && isStringList(v.heaviest_hit, 2, 3) && isStringList(v.least_affected, 2, 3) && isString(v.where_to_pick);
    case "portfolio":
      return isString(v.headline) && isString(v.long_thesis) && isString(v.short_thesis) && isString(v.risk_note);
  }
  return false;
}
