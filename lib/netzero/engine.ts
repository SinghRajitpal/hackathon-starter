import { sectorDispersion, type SectorDispersion } from "./dispersion";
import { runScenario, type CompanyScore, type SectorModel } from "./scenario";
import type { CompanyInput, ScenarioConfig } from "./types";

export interface EngineResult {
  scores: Map<string, CompanyScore>;
  sectors: SectorModel[];
  dispersion: SectorDispersion[];
}

/** One full pass. v2: §4 → §7 → §8. Pure; safe on every input change. */
export function runEngine(companies: CompanyInput[], config: ScenarioConfig): EngineResult {
  const { scores, sectors } = runScenario(companies, config);
  return { scores, sectors, dispersion: sectorDispersion(scores.values(), config) };
}
