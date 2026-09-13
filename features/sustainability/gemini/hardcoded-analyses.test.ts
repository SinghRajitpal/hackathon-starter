import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/sustainability-analysis/route";

import { HARDCODED_ANALYSES } from "./hardcoded-analyses";
import { GeminiAnalysisSchema } from "./schema";

function post(ticker: string) {
  return POST(
    new Request("http://localhost/api/sustainability-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    }),
  );
}

describe("hardcoded sustainability analyses", () => {
  it("every entry satisfies the Gemini analysis schema", () => {
    for (const [ticker, analysis] of Object.entries(HARDCODED_ANALYSES)) {
      expect(GeminiAnalysisSchema.safeParse(analysis).success, ticker).toBe(true);
    }
  });

  it("serves ExxonMobil's hardcoded analysis without calling Gemini", async () => {
    const response = await post("xom");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(HARDCODED_ANALYSES.XOM);
    expect(body.leaderboard_position).toMatchObject({ rank: 436, total_companies: 503 });
  });
});
