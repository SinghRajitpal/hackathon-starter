import { mulberry32 } from "./rng";
import { DEFAULT_OPTIONS, type CompanyInput, type MacVector, type ScenarioConfig } from "./types";

export const MID_MAC: MacVector = { scope2: 30, combustion: 120, fleet: 200, process: 150, fugitive: 15 };

const MT = 1e6;
const BN = 1e9;

function pdfUtility(
  ticker: string,
  elec: number,
  fuel: number,
  fleet: number,
  fugitive: number,
  ebitdaBn: number,
  de: number,
  ndEbitda: number,
): CompanyInput {
  const ebitda = ebitdaBn * BN;
  return {
    ticker,
    companyName: ticker,
    sector: "Utilities",
    subIndustry: "Electric Utilities",
    emissions: { scope2: elec * MT, combustion: fuel * MT, fleet: fleet * MT, process: 0, fugitive: fugitive * MT },
    revenueTtm: ebitda * 4,
    ebitdaTtm: ebitda,
    fcfTtm: null,
    netDebt: ndEbitda * ebitda,
    de,
    ben: 0,
    deBenStatus: "tagged",
    price: null,
    sharesOutstanding: null,
    floatCap: null,
    flags: [],
  };
}

/** The five fictional utilities of PDF §12 (emissions in Mt, EBITDA in USD bn). */
export const PDF_UTILITIES: CompanyInput[] = [
  pdfUtility("U1", 0.2, 40, 0.3, 1.0, 6.0, 0.55, 5.5),
  pdfUtility("U2", 0.1, 12, 0.2, 0.3, 4.0, 0.3, 4.0),
  pdfUtility("U3", 0.3, 25, 0.4, 0.6, 5.0, 0.45, 4.8),
  pdfUtility("U4", 0.1, 3, 0.1, 0.1, 3.0, 0.1, 3.2),
  pdfUtility("U5", 0.2, 30, 0.3, 2.0, 3.5, 0.6, 6.0),
];

/** §12 simplifications: three variables, no log, no winsorising, no cap, leverage target 4.0. */
export const PDF_EXAMPLE_CONFIG: ScenarioConfig = {
  mac: MID_MAC,
  tbrIqrThreshold: 0.25,
  scoreIqrThreshold: 25,
  capital: 1e9,
  mandate: "long-short",
  options: { ...DEFAULT_OPTIONS, variables: ["tbr", "de", "leverage"], logTbr: false, winsorise: false, weightCap: null, leverageTarget: 4.0 },
};

export const DEFAULT_TEST_CONFIG: ScenarioConfig = {
  mac: MID_MAC,
  tbrIqrThreshold: 0.25,
  scoreIqrThreshold: 25,
  capital: 1e9,
  mandate: "long-only",
  options: DEFAULT_OPTIONS,
};

/** Deterministic synthetic universe: 4 sectors × 15 companies, one near-zero-emission sector. */
export function syntheticUniverse(seed = 1): CompanyInput[] {
  const rng = mulberry32(seed);
  const sectors = ["Energy", "Utilities", "Industrials", "Software"];
  const out: CompanyInput[] = [];
  sectors.forEach((sector, s) => {
    for (let i = 0; i < 15; i++) {
      const clean = sector === "Software";
      const revenue = (2 + rng() * 40) * BN;
      const ebitda = revenue * (i === 0 ? -0.02 : 0.08 + rng() * 0.3);
      const e = (scale: number) => (clean ? rng() * 0.01 * MT : rng() * scale * MT);
      out.push({
        ticker: `${sector.slice(0, 3).toUpperCase()}${i}`,
        companyName: `${sector} ${i}`,
        sector,
        subIndustry: sector,
        emissions:
          i === 1
            ? { scope2: null, combustion: null, fleet: null, process: null, fugitive: null }
            : { scope2: e(1), combustion: e(20), fleet: e(2), process: e(8), fugitive: e(3) },
        revenueTtm: revenue,
        ebitdaTtm: i === 2 ? null : ebitda,
        fcfTtm: revenue * (rng() * 0.2 - 0.05),
        netDebt: ebitda * (rng() * 5 - 0.5),
        de: clean ? 0 : rng() * 0.8,
        ben: clean ? 0 : rng() < 0.2 ? rng() * 0.6 : 0,
        deBenStatus: "tagged",
        price: 20 + rng() * 300,
        sharesOutstanding: 1e8 + rng() * 1e9,
        floatCap: (5 + rng() * 300) * BN * (s + 1),
        flags: [],
      });
    }
  });
  return out;
}
