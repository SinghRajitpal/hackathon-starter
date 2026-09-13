import type {
  Category,
  CompanyInput,
  DeBenStatus,
  MacRow,
  ProductMapRow,
  SegmentClass,
  SegmentRow,
  ValidationRow,
} from "./types";

/** Row shapes exactly as the nz_* tables return them (see supabase/schema.sql). */
export interface NzCompanyRow {
  ticker: string;
  company_name: string;
  sector: string;
  sub_industry: string;
  e_scope2: number | string | null;
  e_combustion: number | string | null;
  e_fleet: number | string | null;
  e_process: number | string | null;
  e_fugitive: number | string | null;
  revenue_ttm: number | string | null;
  ebitda_ttm: number | string | null;
  fcf_ttm: number | string | null;
  net_debt: number | string | null;
  de: number | string | null;
  ben: number | string | null;
  de_ben_status: string;
  price: number | string | null;
  shares_outstanding: number | string | null;
  float_cap: number | string | null;
  flags: string[] | null;
}

export interface NzMacRow {
  category: string;
  low: number | string;
  mid: number | string;
  high: number | string;
  source: string;
  source_date: string;
}

export interface NzProductMapRow {
  list: string;
  product_line: string;
  source: string;
}

export interface NzSegmentRow {
  ticker: string;
  segment: string;
  revenue: number | string | null;
  share: number | string | null;
  class: string;
  fiscal_year: number | null;
  filing_url: string | null;
  method: string;
}

export interface NzValidationRow {
  ticker: string;
  sector: string;
  tbr_2019: number | string | null;
  intensity_2019: number | string | null;
  intensity_latest: number | string | null;
  intensity_change: number | string | null;
}

const DE_BEN_STATUSES: DeBenStatus[] = ["tagged", "note", "imputed", "unclassified"];

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toCompanyInput(row: NzCompanyRow): CompanyInput {
  const status = DE_BEN_STATUSES.includes(row.de_ben_status as DeBenStatus)
    ? (row.de_ben_status as DeBenStatus)
    : "unclassified";
  return {
    ticker: row.ticker,
    companyName: row.company_name,
    sector: row.sector,
    subIndustry: row.sub_industry,
    emissions: {
      scope2: toNumber(row.e_scope2),
      combustion: toNumber(row.e_combustion),
      fleet: toNumber(row.e_fleet),
      process: toNumber(row.e_process),
      fugitive: toNumber(row.e_fugitive),
    },
    revenueTtm: toNumber(row.revenue_ttm),
    ebitdaTtm: toNumber(row.ebitda_ttm),
    fcfTtm: toNumber(row.fcf_ttm),
    netDebt: toNumber(row.net_debt),
    de: toNumber(row.de),
    ben: toNumber(row.ben),
    deBenStatus: status,
    price: toNumber(row.price),
    sharesOutstanding: toNumber(row.shares_outstanding),
    floatCap: toNumber(row.float_cap),
    flags: row.flags ?? [],
  };
}

export function toMacRow(row: NzMacRow): MacRow {
  return {
    category: row.category as Category,
    low: Number(row.low),
    mid: Number(row.mid),
    high: Number(row.high),
    source: row.source,
    sourceDate: row.source_date,
  };
}

export function toProductMapRow(row: NzProductMapRow): ProductMapRow {
  return { list: row.list === "beneficiary" ? "beneficiary" : "exposed", productLine: row.product_line, source: row.source };
}

export function toSegmentRow(row: NzSegmentRow): SegmentRow {
  return {
    ticker: row.ticker,
    segment: row.segment,
    revenue: toNumber(row.revenue),
    share: toNumber(row.share),
    segmentClass: row.class as SegmentClass,
    fiscalYear: row.fiscal_year,
    filingUrl: row.filing_url,
    method: row.method === "note" ? "note" : "xbrl",
  };
}

export function toValidationRow(row: NzValidationRow): ValidationRow {
  return {
    ticker: row.ticker,
    sector: row.sector,
    tbr2019: toNumber(row.tbr_2019),
    intensity2019: toNumber(row.intensity_2019),
    intensityLatest: toNumber(row.intensity_latest),
    intensityChange: toNumber(row.intensity_change),
  };
}
