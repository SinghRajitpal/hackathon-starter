import { describe, expect, it } from "vitest";
import { toCompanyInput, toMacRow, toNumber, type NzCompanyRow } from "./rows";

const row: NzCompanyRow = {
  ticker: "XOM",
  company_name: "Exxon Mobil",
  sector: "Energy",
  sub_industry: "Integrated Oil & Gas",
  e_scope2: null,
  e_combustion: 1000,
  e_fleet: "0",
  e_process: "250.5",
  e_fugitive: null,
  revenue_ttm: 3.3e11,
  ebitda_ttm: 6.8e10,
  fcf_ttm: null,
  net_debt: 1e10,
  de: 0.78,
  ben: 0.03,
  de_ben_status: "tagged",
  price: 110.2,
  shares_outstanding: 4.2e9,
  float_cap: 4.6e11,
  flags: null,
};

describe("row mapping", () => {
  it("parses numbers that Postgres may return as strings and keeps nulls", () => {
    expect(toNumber("250.5")).toBe(250.5);
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(null)).toBeNull();
  });

  it("maps an nz_company_inputs row to CompanyInput", () => {
    const c = toCompanyInput(row);
    expect(c.emissions).toEqual({ scope2: null, combustion: 1000, fleet: 0, process: 250.5, fugitive: null });
    expect(c.companyName).toBe("Exxon Mobil");
    expect(c.flags).toEqual([]);
    expect(c.deBenStatus).toBe("tagged");
  });

  it("falls back to unclassified for an unknown DE/BEN status", () => {
    expect(toCompanyInput({ ...row, de_ben_status: "weird" }).deBenStatus).toBe("unclassified");
  });

  it("maps a MAC row", () => {
    expect(toMacRow({ category: "fleet", low: "100", mid: 200, high: 300, source: "IEA", source_date: "2026-09-13" })).toEqual({
      category: "fleet",
      low: 100,
      mid: 200,
      high: 300,
      source: "IEA",
      sourceDate: "2026-09-13",
    });
  });
});
