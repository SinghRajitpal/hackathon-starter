"use client";

import { useState } from "react";

import { TickerLink } from "@/components/netzero/portfolio/ticker-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/netzero/format";
import type { PortfolioView } from "@/lib/netzero/portfolio";
import { DRAW_SURVIVAL_THRESHOLD, runSensitivity, type SensitivityResult } from "@/lib/netzero/sensitivity";
import type { ScenarioData, ValidationRow } from "@/lib/netzero/types";
import { validationSummary } from "@/lib/netzero/validation";

const DRAWS = 1000;
const SEED = 42;

function ValidationCard({ rows }: { rows: ValidationRow[] }) {
  const summary = validationSummary(rows);
  const sectors = Object.entries(summary.bySector).sort((a, b) => b[1] - a[1]);
  const available = summary.n > 0 && summary.spearman !== null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sustainability check: 2019 burden vs decarbonisation since</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {!available ? (
          <p>
            Not available ({summary.n} usable companies) — the 2019 validation check is not loaded. This is reported as
            a limitation (PDF §11); no return backtest is shown because a hypothetical policy shock cannot be
            backtested.
          </p>
        ) : (
          <>
            <p>
              Spearman correlation between TBR computed from 2019 emissions and financials and the change in emissions
              intensity from 2019 to the latest year:{" "}
              <span className="font-semibold">{summary.spearman!.toFixed(2)}</span> across {summary.n} companies.
            </p>
            <p className="text-muted-foreground">
              Hypothesis: low-burden companies decarbonised faster because it was cheaper for them, so the correlation
              should be positive.{" "}
              {summary.spearman! > 0
                ? "The sign supports the hypothesis."
                : "The sign does not support it; this is reported as a limitation."}
            </p>
          </>
        )}
        {sectors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Companies per sector: {sectors.map(([sector, n]) => `${sector} ${n}`).join(" · ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function StressTab({
  data,
  view,
  stress,
  onResult,
}: {
  data: ScenarioData;
  view: PortfolioView;
  stress: SensitivityResult | null;
  onResult: (result: SensitivityResult) => void;
}) {
  const [running, setRunning] = useState(false);
  const longShort = view.config.mandate === "long-short";
  const direction = (sign: number) => (longShort ? (sign > 0 ? "Long" : "Short") : sign > 0 ? "Overweight" : "Underweight");
  const hasBook = data.companies.length > 0;

  const run = () => {
    setRunning(true);
    window.setTimeout(() => {
      onResult(runSensitivity(data.companies, view.config, { draws: DRAWS, seed: SEED }));
      setRunning(false);
    }, 0);
  };

  const picks = stress
    ? [...stress.picks].sort((a, b) => Number(b.robust) - Number(a.robust) || b.drawSurvival - a.drawSurvival)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        The weakest assumptions are the abatement costs and the product mapping tables (PDF §11). The book is rebuilt
        with all costs −50% and +50%, with each cost category doubled on its own, and under {DRAWS} random perturbations
        of the entropy weights. A pick is robust if it keeps its direction in every cost scenario and in at least{" "}
        {formatPercent(DRAW_SURVIVAL_THRESHOLD)} of weight draws. Positions that flip sign under a 50% cost change are
        halved in both books and in the CSV.
      </p>
      <div>
        <Button onClick={run} disabled={running || !hasBook}>
          {running ? "Running stress test…" : stress ? "Rerun stress test" : "Run stress test"}
        </Button>
        {!hasBook && <p className="mt-2 text-sm text-muted-foreground">No companies loaded — nothing to stress-test.</p>}
      </div>

      {stress &&
        (picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">The current book holds no positions, so there is nothing to rank.</p>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {formatPercent(stress.headline)} of {stress.picks.length} picks are robust
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Cost scenarios survived</TableHead>
                    <TableHead>Flips under ±50%</TableHead>
                    <TableHead className="text-right">Weight draws kept</TableHead>
                    <TableHead>Robust</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {picks.map((p) => (
                    <TableRow key={p.ticker}>
                      <TableCell>
                        <TickerLink ticker={p.ticker} />
                      </TableCell>
                      <TableCell>{direction(p.baseSign)}</TableCell>
                      <TableCell className="capitalize">
                        {p.macSurvival} ({p.macSame}/{p.macRuns})
                      </TableCell>
                      <TableCell>{p.flippedUnder50 ? "Yes — halved" : "No"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPercent(p.drawSurvival)}</TableCell>
                      <TableCell>{p.robust ? "Yes" : "No"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ))}

      <ValidationCard rows={data.validation} />
    </div>
  );
}
