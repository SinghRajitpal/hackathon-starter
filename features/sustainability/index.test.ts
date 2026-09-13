import { describe, expect, it } from "vitest";

import { getSustainabilityRanking, getSustainabilityScore } from "@/features/sustainability";

const live = describe.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL);

live("sustainability public interface (live Supabase)", () => {
  it("returns one company's score row for a lowercase ticker", async () => {
    const result = await getSustainabilityScore("aapl");

    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("AAPL");
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
    expect(result!.rank).toBeGreaterThanOrEqual(1);
    expect(typeof result!.contrib_env_intensity).toBe("number");
  });

  it("returns null for a ticker outside the S&P 500", async () => {
    expect(await getSustainabilityScore("ZZZZ")).toBeNull();
  });

  it("ranks the whole index from rank 1 upward", async () => {
    const rows = await getSustainabilityRanking();

    expect(rows.length).toBeGreaterThanOrEqual(500);
    expect(rows[0].rank).toBe(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].rank).toBeGreaterThanOrEqual(rows[i - 1].rank);
    }
    expect(new Set(rows.map((r) => r.ticker)).size).toBe(rows.length);
  });
});
