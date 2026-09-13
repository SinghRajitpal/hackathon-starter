"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatPercent } from "@/lib/netzero/format";
import { runSensitivity, type SensitivityResult } from "@/lib/netzero/sensitivity";
import type { CompanyInput, ScenarioConfig } from "@/lib/netzero/types";

/** PDF §11 via the decisions log: 1,000 seeded Dirichlet draws. ~0.5 s on 503 companies. */
export const STRESS_DRAWS = 1000;
export const STRESS_SEED = 42;

const SURVIVAL_TEXT = {
  all: "keeps its direction in all 7 cost scenarios",
  most: "keeps its direction in most cost scenarios",
  few: "keeps its direction in few cost scenarios",
} as const;

export function StressSection({
  ticker,
  companies,
  config,
}: {
  ticker: string;
  companies: CompanyInput[];
  config: ScenarioConfig;
}) {
  const [result, setResult] = useState<SensitivityResult | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // Yield one frame so "Running…" paints before the synchronous run blocks the main thread.
    setTimeout(() => {
      setResult(runSensitivity(companies, config, { draws: STRESS_DRAWS, seed: STRESS_SEED }));
      setRunning(false);
    }, 0);
  }

  const pick = result?.picks.find((p) => p.ticker === ticker);
  const book = config.mandate === "long-short" ? "long/short" : "long-only";

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Stress test</h3>
      <div>
        <Button size="sm" variant="outline" onClick={run} disabled={running}>
          {running ? "Running…" : result ? "Run again" : "Run stress test"}
        </Button>
      </div>
      {result && (
        <>
          {pick ? (
            <div className="flex flex-col gap-1 text-sm">
              <p>
                {ticker} {SURVIVAL_TEXT[pick.macSurvival]} ({pick.macSame}/{pick.macRuns}) and in{" "}
                {formatPercent(pick.drawSurvival)} of {result.draws.toLocaleString()} weight draws.
              </p>
              <p className={pick.robust ? "font-semibold text-primary" : "font-semibold text-muted-foreground"}>
                {pick.robust ? "Robust pick" : "Not robust"}
              </p>
              {pick.flippedUnder50 && (
                <p className="text-xs text-destructive">Flips direction under ±50% costs: position is halved.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ticker} has no position in the {book} book, so there is nothing to stress.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Book-wide: {formatPercent(result.headline)} of {result.picks.length} {book} picks are robust (seed{" "}
            {result.seed}).
          </p>
        </>
      )}
    </section>
  );
}
