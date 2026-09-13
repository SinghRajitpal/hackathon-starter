import { describe, expect, it } from "vitest";
import { allocateLongOnly, allocateLongShort, toCsv, type AllocationRow } from "./allocation";
import { runEngine } from "./engine";
import { reasonSentence, topDrivers } from "./explain";
import { DEFAULT_TEST_CONFIG, syntheticUniverse } from "./fixtures";
import type { CompanyScore } from "./scenario";
import type { Variable } from "./types";

describe("explanations (spec D17)", () => {
  it("names the two largest decomposition shares", () => {
    expect(topDrivers({ tbr: 0.2, de: 0.5, ben: 0, leverage: 0.3, fcfMargin: 0 })).toEqual(["de", "leverage"]);
  });

  it("builds a sentence with the burden and fossil share", () => {
    const s = { tbr: 1.06, de: 0.6, ben: 0, ndEbitda: 6, shares: { tbr: 0.3, de: 0.5, leverage: 0.2 } } as unknown as CompanyScore;
    expect(reasonSentence(s, "short", 0.62)).toBe(
      "Short: burden 1.06 years of earnings (sector median 0.62 years), fossil revenue 60%, beneficiary revenue 0%, net debt/EBITDA 6.0x; largest gaps to the sector ideal: fossil revenue share and transition burden.",
    );
  });
});

describe("allocation (PDF §10)", () => {
  const companies = syntheticUniverse();
  const result = runEngine(companies, DEFAULT_TEST_CONFIG);

  it("turns long/short weights into signed dollars and whole shares with a reason", () => {
    const rows = allocateLongShort(result.longShort, result.scores, companies, result.dispersion, 1e9);
    expect(rows.length).toBe(result.longShort.positions.length);
    for (const r of rows) {
      expect(r.dollars).toBeCloseTo(r.weight * 1e9, 3);
      expect(r.shares).toBe(Math.floor(Math.abs(r.dollars) / r.price!));
      expect(r.reason.length).toBeGreaterThan(20);
      expect(r.position === "long" ? r.weight > 0 : r.weight < 0).toBe(true);
    }
  });

  it("lists every benchmark name in the long-only vector and exports CSV", () => {
    const rows = allocateLongOnly(result.longOnly, result.scores, companies, result.dispersion, 1e9);
    expect(rows).toHaveLength(result.longOnly.weights.size);
    expect(rows.reduce((a, r) => a + r.dollars, 0)).toBeCloseTo(1e9, 0);
    const csv = toCsv(rows).split("\n");
    expect(csv[0]).toBe(
      "ticker,companyName,sector,position,weight,benchmarkWeight,activeWeight,dollars,shares,price,score,drivers,reason",
    );
    expect(csv).toHaveLength(rows.length + 1);
  });

  it("exposes the exclusion book from runEngine", () => {
    expect(result.exclusion.excluded).toHaveLength(6);
  });
});

describe("toCsv (finding 6: \\r quoting and formula-injection guard)", () => {
  const base: AllocationRow = {
    ticker: "T1",
    companyName: "=cmd()",
    sector: "Energy",
    position: "long",
    weight: -0.05,
    benchmarkWeight: null,
    activeWeight: null,
    dollars: -5e7,
    shares: 100,
    price: 20,
    score: 0.5,
    drivers: ["+HACK" as unknown as Variable],
    reason: "@import danger",
  };

  it("prefixes formula-triggering text cells with a single quote but leaves negative numbers untouched", () => {
    const cells = toCsv([base]).split("\n")[1].split(",");
    expect(cells[1]).toBe("'=cmd()"); // companyName
    expect(cells[4]).toBe("-0.05"); // weight (numeric, negative) untouched
    expect(cells[7]).toBe("-50000000"); // dollars (numeric, negative) untouched
    expect(cells[11]).toBe("'+HACK"); // drivers
    expect(cells[12]).toBe("'@import danger"); // reason
  });

  it("quotes a cell containing a carriage return", () => {
    const row = { ...base, companyName: "Foo\rBar" };
    expect(toCsv([row])).toContain('"Foo\rBar"');
  });
});
