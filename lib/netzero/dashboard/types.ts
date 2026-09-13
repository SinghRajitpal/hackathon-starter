import type { MacPoint } from "@/lib/netzero/config";
import type { EngineResult } from "@/lib/netzero/engine";
import type { SensitivityResult } from "@/lib/netzero/sensitivity";
import type { ScenarioConfig, ScenarioData } from "@/lib/netzero/types";

export type View = "market" | "sector" | "company" | "portfolio";
export const VIEWS: View[] = ["market", "sector", "company", "portfolio"];

export type Tone = "good" | "bad" | "warn" | "neutral";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}

export type SectorVerdict = "pick-winners" | "sector-hit" | "barely-affected";
export type CompanyLabel = "leader" | "middle" | "laggard";

export type PresetId = "conservative" | "balanced" | "aggressive";
export type TrailTolerance = "low" | "medium" | "high";

export interface RiskAnswers {
  /** "How far may the fund trail the S&P 500 in a bad year?" low = under 1%, medium = up to 3%, high = more. */
  trail: TrailTolerance;
  allowShorts: boolean;
  robustOnly: boolean;
}

export interface Preset {
  id: PresetId;
  label: string;
  tbrIqrThreshold: number;
  scoreIqrThreshold: number;
  /** Long-only active weight limit per name, as a fraction (0.02 = ±2pp). */
  activeLimit: number;
  robustOnly: boolean;
  longShort: boolean;
}

/** PDF §10 inputs that stay adjustable outside the presets. */
export interface AdjustControls {
  capital: number;
  macPoint: MacPoint;
}

export interface DashboardModel {
  preset: Preset;
  answers: RiskAnswers;
  adjust: AdjustControls;
  config: ScenarioConfig;
  result: EngineResult;
  /** Stress test for the preset's book; null when it has not been computed. */
  stress: SensitivityResult | null;
}

export interface Nav {
  openView(view: View): void;
  openSector(sector: string): void;
  openCompany(ticker: string): void;
}

export interface ScreenProps {
  data: ScenarioData;
  model: DashboardModel;
  nav: Nav;
}
