import type { PortfolioView } from "@/lib/netzero/portfolio";
import type { ScenarioData } from "@/lib/netzero/types";

export function MethodTab({ data }: { data: ScenarioData; view: PortfolioView }) {
  return <p className="text-sm">{data.macRows.length} cost rows</p>;
}
