import type { PortfolioView } from "@/lib/netzero/portfolio";
import type { SensitivityResult } from "@/lib/netzero/sensitivity";
import type { ScenarioData } from "@/lib/netzero/types";

export function StressTab({
  stress,
}: {
  data: ScenarioData;
  view: PortfolioView;
  stress: SensitivityResult | null;
  onResult: (result: SensitivityResult) => void;
}) {
  return <p className="text-sm">{stress ? "Stress result ready" : "Stress test not run"}</p>;
}
