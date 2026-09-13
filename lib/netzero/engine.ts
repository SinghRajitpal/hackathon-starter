import { sectorDispersion, type SectorDispersion } from "./dispersion";
import { buildLongShort, type LongShortBook } from "./longShort";
import { runScenario, type CompanyScore, type SectorModel } from "./scenario";
import type { CompanyInput, ScenarioConfig } from "./types";

export interface EngineResult {
  scores: Map<string, CompanyScore>;
  sectors: SectorModel[];
  dispersion: SectorDispersion[];
  longShort: LongShortBook;
}

/** One full pass. v3: §4 → §7 → §8 → §9.1. Pure; safe on every input change. */
export function runEngine(companies: CompanyInput[], config: ScenarioConfig): EngineResult {
  const { scores, sectors } = runScenario(companies, config);
  const dispersion = sectorDispersion(scores.values(), config);
  return { scores, sectors, dispersion, longShort: buildLongShort(scores, dispersion) };
}
