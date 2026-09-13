import { allocateLongOnly, allocateLongShort, type AllocationRow } from "./allocation";
import { defaultConfig, macVector, type MacPoint } from "./config";
import { runEngine, type EngineResult } from "./engine";
import type { LongOnlyBook } from "./longOnly";
import type { LongShortBook } from "./longShort";
import type { CompanyScore } from "./scenario";
import { halveLongOnly, halveLongShort } from "./sensitivity";
import {
  DEFAULT_CAPITAL,
  DEFAULT_SCORE_IQR_THRESHOLD,
  DEFAULT_TBR_IQR_THRESHOLD,
  type Category,
  type DeBenStatus,
  type Mandate,
  type ScenarioConfig,
  type ScenarioData,
} from "./types";

/** What the user can change on /portfolio (PDF §10). */
export interface PortfolioControls {
  capital: number;
  mandate: Mandate;
  macPoint: MacPoint;
  tbrIqrThreshold: number;
  scoreIqrThreshold: number;
}

export const DEFAULT_CONTROLS: PortfolioControls = {
  capital: DEFAULT_CAPITAL,
  mandate: "long-only",
  macPoint: "mid",
  tbrIqrThreshold: DEFAULT_TBR_IQR_THRESHOLD,
  scoreIqrThreshold: DEFAULT_SCORE_IQR_THRESHOLD,
};

export const TOP_N = 10;

/**
 * Parses the capital control's raw input (PDF §10); null means keep the previous value.
 * Empty/whitespace input is ignored rather than falling through to `Number("") === 0`,
 * which would silently zero the capital while the user is mid-edit.
 */
export function parseCapitalInput(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface PortfolioSummary {
  /** Fractions of capital for the selected mandate. */
  gross: number;
  net: number;
  cash: number;
  names: number;
  /** Long-only tilt active share = Σ|active weight| / 2, always taken from the long-only book. */
  activeShare: number;
}

export interface SectorWeightRow {
  sector: string;
  tradeable: boolean;
  benchmark: number;
  tilt: number;
  exclusion: number;
  /** Long/short gross allotted to the sector, fraction of capital. */
  longShortGross: number;
}

export interface PortfolioView {
  config: ScenarioConfig;
  result: EngineResult;
  /** Books after §11 halving (identical to result books when nothing is flipped). */
  longShort: LongShortBook;
  longOnly: LongOnlyBook;
  halved: string[];
  rows: AllocationRow[];
  longOnlyRows: AllocationRow[];
  longShortRows: AllocationRow[];
  summary: PortfolioSummary;
  sectorTable: SectorWeightRow[];
  topOverweights: AllocationRow[];
  topUnderweights: AllocationRow[];
  largestLongs: AllocationRow[];
  largestShorts: AllocationRow[];
  macMissing: Category[];
}

export function configFromControls(
  data: ScenarioData,
  controls: PortfolioControls,
): { config: ScenarioConfig; macMissing: Category[] } {
  const { mac, missing } = macVector(data.macRows, controls.macPoint);
  return {
    config: {
      ...defaultConfig(mac),
      capital: controls.capital,
      mandate: controls.mandate,
      tbrIqrThreshold: controls.tbrIqrThreshold,
      scoreIqrThreshold: controls.scoreIqrThreshold,
    },
    macMissing: missing,
  };
}

/** Stress results depend on costs, mandate and thresholds, not on capital. */
export function stressKey(config: ScenarioConfig): string {
  return JSON.stringify([config.mac, config.mandate, config.tbrIqrThreshold, config.scoreIqrThreshold]);
}

export function buildPortfolioView(
  data: ScenarioData,
  controls: PortfolioControls,
  flipped: ReadonlySet<string> = new Set(),
): PortfolioView {
  const { config, macMissing } = configFromControls(data, controls);
  const result = runEngine(data.companies, config);
  const flippedSet = new Set(flipped);
  // A stress result only carries flips for the mandate it ran on (lib/netzero/sensitivity.ts bookSigns),
  // so halving must only ever touch that mandate's book — the other book stays exactly as the engine built it.
  const longShort =
    flippedSet.size > 0 && config.mandate === "long-short" ? halveLongShort(result.longShort, flippedSet) : result.longShort;
  const longOnly =
    flippedSet.size > 0 && config.mandate === "long-only" ? halveLongOnly(result.longOnly, flippedSet) : result.longOnly;

  const longOnlyRows = allocateLongOnly(longOnly, result.scores, data.companies, result.dispersion, controls.capital);
  const longShortRows = allocateLongShort(longShort, result.scores, data.companies, result.dispersion, controls.capital);

  const loWeights = [...longOnly.weights.values()];
  const activeShare = loWeights.reduce((a, w) => a + Math.abs(w.active), 0) / 2;
  const loGross = loWeights.reduce((a, w) => a + w.portfolio, 0);
  const summary: PortfolioSummary =
    controls.mandate === "long-only"
      ? {
          gross: loGross,
          net: loGross,
          cash: Math.max(0, 1 - loGross),
          names: loWeights.filter((w) => w.portfolio > 1e-12).length,
          activeShare,
        }
      : {
          gross: longShort.gross,
          net: longShort.net,
          cash: longShort.cash,
          names: longShort.positions.length,
          activeShare,
        };

  const sectorTable: SectorWeightRow[] = result.dispersion
    .map((d) => ({
      sector: d.sector,
      tradeable: d.tradeable,
      benchmark: longOnly.sectorWeights.get(d.sector)?.benchmark ?? 0,
      tilt: longOnly.sectorWeights.get(d.sector)?.portfolio ?? 0,
      exclusion: result.exclusion.sectorWeights.get(d.sector) ?? 0,
      longShortGross: longShort.sectorGross.get(d.sector) ?? 0,
    }))
    .sort((a, b) => b.benchmark - a.benchmark);

  // Only the stressed mandate's book was actually halved above, so only look at that book here too —
  // otherwise a flipped ticker that merely exists (unhalved) in the other book would inflate this count.
  const halved = [...flippedSet]
    .filter((t) =>
      config.mandate === "long-short"
        ? longShort.positions.some((p) => p.ticker === t)
        : Math.abs(longOnly.weights.get(t)?.active ?? 0) > 1e-12,
    )
    .sort();

  return {
    config,
    result,
    longShort,
    longOnly,
    halved,
    rows: controls.mandate === "long-only" ? longOnlyRows : longShortRows,
    longOnlyRows,
    longShortRows,
    summary,
    sectorTable,
    topOverweights: longOnlyRows
      .filter((r) => (r.activeWeight ?? 0) > 1e-9)
      .sort((a, b) => (b.activeWeight ?? 0) - (a.activeWeight ?? 0))
      .slice(0, TOP_N),
    topUnderweights: longOnlyRows
      .filter((r) => (r.activeWeight ?? 0) < -1e-9)
      .sort((a, b) => (a.activeWeight ?? 0) - (b.activeWeight ?? 0))
      .slice(0, TOP_N),
    largestLongs: longShortRows
      .filter((r) => r.position === "long")
      .sort((a, b) => b.weight - a.weight)
      .slice(0, TOP_N),
    largestShorts: longShortRows
      .filter((r) => r.position === "short")
      .sort((a, b) => a.weight - b.weight)
      .slice(0, TOP_N),
    macMissing,
  };
}

export interface Coverage {
  companies: number;
  withEmissions: number;
  noEmissions: number;
  missingEbitda: number;
  missingFloatCap: number;
  deBenStatus: Record<DeBenStatus, number>;
  /** [flag, count], most frequent first. */
  flags: [string, number][];
}

/**
 * Data coverage shown on the method tab (PDF §15: state clearly what is classified).
 * When `scores` is supplied, flags are counted from each company's merged `CompanyScore.flags`
 * (engine-derived flags such as tbr-imputed-no-emissions, leverage-negative-ebitda); otherwise
 * from the raw `CompanyInput.flags`.
 */
export function coverageCounts(data: ScenarioData, scores?: Map<string, CompanyScore>): Coverage {
  const deBenStatus: Record<DeBenStatus, number> = { tagged: 0, note: 0, imputed: 0, unclassified: 0 };
  const flagCounts = new Map<string, number>();
  let withEmissions = 0;
  let missingEbitda = 0;
  let missingFloatCap = 0;
  for (const c of data.companies) {
    if (Object.values(c.emissions).some((e) => e !== null)) withEmissions++;
    if (c.ebitdaTtm === null) missingEbitda++;
    if (c.floatCap === null || c.floatCap <= 0) missingFloatCap++;
    deBenStatus[c.deBenStatus]++;
    const flags = scores?.get(c.ticker)?.flags ?? c.flags;
    for (const flag of flags) flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
  }
  return {
    companies: data.companies.length,
    withEmissions,
    noEmissions: data.companies.length - withEmissions,
    missingEbitda,
    missingFloatCap,
    deBenStatus,
    flags: [...flagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  };
}
