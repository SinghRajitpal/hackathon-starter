import { runScenario, type CompanyScore, type SectorModel } from "./scenario";
import type { CompanyInput, ScenarioConfig } from "./types";

export interface EngineResult {
  scores: Map<string, CompanyScore>;
  sectors: SectorModel[];
}

/** One full pass. v1: §4 → §7. P5–P7 add dispersion and books. Pure; safe on every input change. */
export function runEngine(companies: CompanyInput[], config: ScenarioConfig): EngineResult {
  const { scores, sectors } = runScenario(companies, config);
  return { scores, sectors };
}
