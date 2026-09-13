import { CompanyDetail } from "@/features/sustainability/components/company-detail";
import { GeminiAnalysisCard } from "@/features/sustainability/components/gemini-analysis";
import type { SustainabilityResult } from "@/features/sustainability/types";

/** Tool 1's full company analysis: score breakdown, then the Gemini narrative. */
export function SustainabilityAnalysisPane({ row }: { row: SustainabilityResult }) {
  return (
    <div className="flex flex-col gap-4">
      <CompanyDetail row={row} />
      <GeminiAnalysisCard ticker={row.ticker} />
    </div>
  );
}
