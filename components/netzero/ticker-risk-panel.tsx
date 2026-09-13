"use client";

import { InputsSection } from "@/components/netzero/sections/inputs-section";
import type { ScenarioData } from "@/lib/netzero/types";

export function NetZeroRiskPanel({ ticker, data }: { ticker: string; data: ScenarioData }) {
  if (data.error) {
    return <p className="text-sm text-destructive">Net-zero scenario data failed to load: {data.error}</p>;
  }
  const company = data.companies.find((c) => c.ticker === ticker);
  if (!company) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.companies.length === 0
          ? "Net-zero scenario data is not loaded yet."
          : `${ticker} is not in the net-zero scenario universe.`}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <InputsSection company={company} />
    </div>
  );
}
