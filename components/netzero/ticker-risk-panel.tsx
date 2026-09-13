"use client";

import Link from "next/link";
import { useMemo } from "react";

import { BurdenSection } from "@/components/netzero/sections/burden-section";
import { InputsSection } from "@/components/netzero/sections/inputs-section";
import { PositionSection } from "@/components/netzero/sections/position-section";
import { ScoreSection } from "@/components/netzero/sections/score-section";
import { SectorContextSection } from "@/components/netzero/sections/sector-context-section";
import { StressSection } from "@/components/netzero/sections/stress-section";
import { defaultConfig, macVector } from "@/lib/netzero/config";
import { runEngine } from "@/lib/netzero/engine";
import type { ScenarioData } from "@/lib/netzero/types";

export function NetZeroRiskPanel({ ticker, data }: { ticker: string; data: ScenarioData }) {
  const run = useMemo(() => {
    if (data.error || data.companies.length === 0) return null;
    const config = defaultConfig(macVector(data.macRows).mac);
    return { config, result: runEngine(data.companies, config) };
  }, [data]);

  if (data.error) {
    return <p className="text-sm text-destructive">Net-zero scenario data failed to load: {data.error}</p>;
  }
  const company = data.companies.find((c) => c.ticker === ticker);
  if (!company || !run) {
    return (
      <p className="text-sm text-muted-foreground">
        {data.companies.length === 0
          ? "Net-zero scenario data is not loaded yet."
          : `${ticker} is not in the net-zero scenario universe.`}
      </p>
    );
  }

  const score = run.result.scores.get(ticker)!;
  const model = run.result.sectors.find((s) => s.sector === company.sector)!;
  const dispersion = run.result.dispersion.find((d) => d.sector === company.sector)!;

  return (
    <div className="flex flex-col gap-6">
      {company.deBenStatus === "unclassified" && (
        <div role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          DE/BEN not yet classified: running with 0 (PDF §15). Demand exposure and beneficiary share count as zero for
          every company until segment classification is loaded.
        </div>
      )}
      <PositionSection
        ticker={ticker}
        score={score}
        sectorMedianTbr={dispersion.medianTbr}
        longShort={run.result.longShort}
        longOnly={run.result.longOnly}
      />
      <ScoreSection score={score} model={model} />
      <BurdenSection company={company} score={score} sectorMedianTbr={dispersion.medianTbr} mac={run.config.mac} />
      <SectorContextSection
        dispersion={dispersion}
        tbrIqrThreshold={run.config.tbrIqrThreshold}
        scoreIqrThreshold={run.config.scoreIqrThreshold}
      />
      <StressSection ticker={ticker} companies={data.companies} config={run.config} />
      <InputsSection company={company} flags={score.flags} />
      <Link href={`/portfolio?ticker=${encodeURIComponent(ticker)}`} className="text-sm font-medium underline">
        Open in portfolio →
      </Link>
    </div>
  );
}
