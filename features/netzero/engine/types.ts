export const CATEGORIES = ["scope2", "combustion", "fleet", "process", "fugitive"] as const;
export type Category = (typeof CATEGORIES)[number];
export type MacVector = Record<Category, number>;
export type Emissions = Record<Category, number | null>;

export const CATEGORY_LABEL: Record<Category, string> = {
  scope2: "Purchased electricity",
  combustion: "On-site fuel combustion",
  fleet: "Vehicle fleets",
  process: "Process emissions",
  fugitive: "Fugitive emissions",
};

export const VARIABLES = ["tbr", "de", "ben", "leverage", "fcfMargin"] as const;
export type Variable = (typeof VARIABLES)[number];

export const VARIABLE_LABEL: Record<Variable, string> = {
  tbr: "transition burden",
  de: "fossil revenue share",
  ben: "beneficiary revenue share",
  leverage: "leverage vs sector target",
  fcfMargin: "FCF margin",
};

export type DeBenStatus = "tagged" | "note" | "imputed" | "unclassified";

export interface CompanyInput {
  ticker: string;
  companyName: string;
  sector: string;
  subIndustry: string;
  emissions: Emissions;
  revenueTtm: number | null;
  ebitdaTtm: number | null;
  fcfTtm: number | null;
  netDebt: number | null;
  de: number | null;
  ben: number | null;
  deBenStatus: DeBenStatus;
  price: number | null;
  sharesOutstanding: number | null;
  floatCap: number | null;
  flags: string[];
}

export type Mandate = "long-only" | "long-short";

export interface EngineOptions {
  variables: readonly Variable[];
  logTbr: boolean;
  winsorise: boolean;
  weightCap: number | null;
  /** null = sector median (PDF §6). Set only to reproduce the §12 example. */
  leverageTarget: number | null;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  variables: VARIABLES,
  logTbr: true,
  winsorise: true,
  weightCap: 0.4,
  leverageTarget: null,
};

export interface ScenarioConfig {
  mac: MacVector;
  tbrIqrThreshold: number;
  scoreIqrThreshold: number;
  capital: number;
  mandate: Mandate;
  options: EngineOptions;
}

export interface MacRow {
  category: Category;
  low: number;
  mid: number;
  high: number;
  source: string;
  sourceDate: string;
}

export interface ProductMapRow {
  list: "exposed" | "beneficiary";
  productLine: string;
  source: string;
}

export type SegmentClass = "exposed" | "beneficiary" | "neutral" | "electricity_generation";

export interface SegmentRow {
  ticker: string;
  segment: string;
  revenue: number | null;
  share: number | null;
  segmentClass: SegmentClass;
  fiscalYear: number | null;
  filingUrl: string | null;
  method: "xbrl" | "note";
}

export interface ValidationRow {
  ticker: string;
  sector: string;
  tbr2019: number | null;
  intensity2019: number | null;
  intensityLatest: number | null;
  intensityChange: number | null;
}

/** Everything the pages load from Supabase, as plain serialisable data. */
export interface ScenarioData {
  companies: CompanyInput[];
  macRows: MacRow[];
  productMap: ProductMapRow[];
  segments: SegmentRow[];
  validation: ValidationRow[];
  error: string | null;
}

export const DEFAULT_TBR_IQR_THRESHOLD = 0.25;
export const DEFAULT_SCORE_IQR_THRESHOLD = 25;
export const DEFAULT_CAPITAL = 1_000_000_000;
