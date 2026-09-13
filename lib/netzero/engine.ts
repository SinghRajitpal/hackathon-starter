import { sectorDispersion, type SectorDispersion } from "./dispersion";
import { buildExclusion, type ExclusionBook } from "./exclusion";
import { buildLongOnly, type LongOnlyBook } from "./longOnly";
import { buildLongShort, type LongShortBook } from "./longShort";
import { runScenario, type CompanyScore, type SectorModel } from "./scenario";
import type { CompanyInput, ScenarioConfig } from "./types";

export interface EngineResult {
  scores: Map<string, CompanyScore>;
  sectors: SectorModel[];
  dispersion: SectorDispersion[];
  longShort: LongShortBook;
  longOnly: LongOnlyBook;
  exclusion: ExclusionBook;
}

/** One full pass: §4 → §7 → §8 → §9. Pure; safe to call on every input change. */
export function runEngine(companies: CompanyInput[], config: ScenarioConfig): EngineResult {
  const { scores, sectors } = runScenario(companies, config);
  const dispersion = sectorDispersion(scores.values(), config);
  return {
    scores,
    sectors,
    dispersion,
    longShort: buildLongShort(scores, dispersion),
    longOnly: buildLongOnly(scores, companies, dispersion),
    exclusion: buildExclusion(companies),
  };
}
