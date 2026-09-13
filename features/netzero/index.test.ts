import { describe, expect, it } from "vitest";

import { getNetZeroRanking, getNetZeroScenario } from "@/features/netzero";

const live = describe.skipIf(!process.env.NEXT_PUBLIC_SUPABASE_URL);

live("net-zero public interface (live Supabase)", () => {
  it("loads the scenario universe for a lowercase ticker inside it", async () => {
    const result = await getNetZeroScenario("aapl");

    expect(result.data.error).toBeNull();
    expect(result.ticker).toBe("AAPL");
    expect(result.inUniverse).toBe(true);
    expect(result.data.companies.length).toBeGreaterThanOrEqual(500);
  }, 60_000);

  it("flags a ticker outside the universe", async () => {
    const result = await getNetZeroScenario("ZZZZ");

    expect(result.ticker).toBe("ZZZZ");
    expect(result.inUniverse).toBe(false);
  }, 60_000);

  it("ranks every company once, from 1 to the sector size inside each sector", async () => {
    const rows = await getNetZeroRanking();

    expect(rows.length).toBeGreaterThanOrEqual(500);
    expect(new Set(rows.map((r) => r.ticker)).size).toBe(rows.length);
    const bySector = Map.groupBy(rows, (r) => r.sector);
    for (const sectorRows of bySector.values()) {
      expect(sectorRows[0].rank).toBe(1);
      expect(sectorRows.at(-1)!.rank).toBe(sectorRows[0].sectorSize);
    }
  }, 60_000);
});
