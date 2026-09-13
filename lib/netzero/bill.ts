import { median, quantile } from "./stats";
import { CATEGORIES, type CompanyInput, type Emissions, type MacVector } from "./types";

/** [gap] EBITDA margin below this counts as near-zero EBITDA (PDF §4). */
export const NEAR_ZERO_EBITDA_MARGIN = 0.01;

/** PDF §4: Bill = Σ E_category × MAC_category, MAC floored at zero. Null when no emissions at all. */
export function transitionBill(emissions: Emissions, mac: MacVector): number | null {
  let total = 0;
  let any = false;
  for (const c of CATEGORIES) {
    const e = emissions[c];
    if (e === null) continue;
    any = true;
    total += e * Math.max(mac[c], 0);
  }
  return any ? total : null;
}

export interface TbrResult {
  bill: number | null;
  /** Years of EBITDA needed to pay the bill, before winsorising. */
  tbr: number;
  flags: string[];
}

function isNearZeroEbitda(c: CompanyInput): boolean {
  if (c.ebitdaTtm === null) return false;
  if (c.ebitdaTtm <= 0) return true;
  return c.revenueTtm !== null && c.revenueTtm > 0 && c.ebitdaTtm / c.revenueTtm < NEAR_ZERO_EBITDA_MARGIN;
}

/** TBR for every company of ONE sector, with the §4 and D11 fallbacks. */
export function sectorTbr(companies: CompanyInput[], mac: MacVector): Map<string, TbrResult> {
  const bills = new Map(companies.map((c) => [c.ticker, transitionBill(c.emissions, mac)]));
  const valid: number[] = [];
  for (const c of companies) {
    const bill = bills.get(c.ticker)!;
    if (bill !== null && c.ebitdaTtm !== null && !isNearZeroEbitda(c)) valid.push(bill / c.ebitdaTtm);
  }
  const ceiling = valid.length ? quantile(valid, 0.975) : 0;
  const sectorMedian = valid.length ? median(valid) : 0;

  const out = new Map<string, TbrResult>();
  for (const c of companies) {
    const bill = bills.get(c.ticker)!;
    const flags: string[] = [];
    let tbr: number;
    if (bill === null) {
      tbr = sectorMedian;
      flags.push("tbr-imputed-no-emissions");
    } else if (c.ebitdaTtm === null) {
      tbr = sectorMedian;
      flags.push("tbr-imputed-no-ebitda");
    } else if (isNearZeroEbitda(c)) {
      tbr = ceiling;
      flags.push("ebitda-near-zero");
    } else {
      tbr = bill / c.ebitdaTtm;
    }
    if (valid.length === 0) flags.push("tbr-no-sector-data");
    out.set(c.ticker, { bill, tbr, flags });
  }
  return out;
}
