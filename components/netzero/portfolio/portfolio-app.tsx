"use client";

import { useMemo, useState } from "react";

import { Controls } from "@/components/netzero/portfolio/controls";
import { CsvButton } from "@/components/netzero/portfolio/csv-button";
import { LongOnlyTab } from "@/components/netzero/portfolio/long-only-tab";
import { LongShortTab } from "@/components/netzero/portfolio/long-short-tab";
import { MethodTab } from "@/components/netzero/portfolio/method-tab";
import { SectorsTab } from "@/components/netzero/portfolio/sectors-tab";
import { StressTab } from "@/components/netzero/portfolio/stress-tab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUsd } from "@/lib/netzero/format";
import {
  buildPortfolioView,
  configFromControls,
  DEFAULT_CONTROLS,
  stressKey,
  type PortfolioControls,
} from "@/lib/netzero/portfolio";
import { flippedTickers, type SensitivityResult } from "@/lib/netzero/sensitivity";
import type { ScenarioData } from "@/lib/netzero/types";

type TabValue = "sectors" | "long-only" | "long-short" | "stress" | "method";

export function PortfolioApp({ data, highlight }: { data: ScenarioData; highlight: string | null }) {
  const [controls, setControls] = useState<PortfolioControls>(DEFAULT_CONTROLS);
  const [tab, setTab] = useState<TabValue>("long-only");
  const [stress, setStress] = useState<{ key: string; result: SensitivityResult } | null>(null);

  const ready = !data.error && data.companies.length > 0;
  const key = useMemo(() => (ready ? stressKey(configFromControls(data, controls).config) : ""), [ready, data, controls]);
  const currentStress = stress && stress.key === key ? stress.result : null;
  const flipped = useMemo(() => (currentStress ? flippedTickers(currentStress) : new Set<string>()), [currentStress]);
  const view = useMemo(() => (ready ? buildPortfolioView(data, controls, flipped) : null), [ready, data, controls, flipped]);

  if (data.error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-base">Scenario data failed to load</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{data.error}</CardContent>
      </Card>
    );
  }
  if (!view) {
    return <p className="text-sm text-muted-foreground">Net-zero scenario data is not loaded yet.</p>;
  }

  const allUnclassified = data.companies.every((c) => c.deBenStatus === "unclassified");
  const highlighted = highlight ? view.rows.find((r) => r.ticker === highlight) : undefined;

  const updateControls = (next: PortfolioControls) => {
    if (next.mandate !== controls.mandate) setTab(next.mandate);
    setControls(next);
  };

  return (
    <div className="flex flex-col gap-6">
      {allUnclassified && (
        <div role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          DE/BEN not yet classified: running with 0 (PDF §15). Demand exposure and beneficiary share count as zero for
          every company until segment classification is loaded.
        </div>
      )}
      {view.macMissing.length > 0 && (
        <div role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          Abatement costs missing for {view.macMissing.join(", ")}; the PDF §12 mid-points are used for those categories.
        </div>
      )}

      <Controls value={controls} onChange={updateControls} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p>
          {controls.mandate === "long-only" ? "Long-only sector-neutral tilt" : "Sector-neutral long/short"} on{" "}
          {formatUsd(controls.capital)}
          {view.halved.length > 0 ? ` · ${view.halved.length} positions halved after the stress test` : ""}
        </p>
        <CsvButton rows={view.rows} mandate={controls.mandate} />
      </div>

      {highlight && (
        <p className="rounded-md border p-3 text-sm">
          {highlighted ? (
            <>
              <span className="font-mono font-bold">{highlight}</span>: {highlighted.reason}
            </>
          ) : (
            `${highlight} has no position in the current book.`
          )}
        </p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="sectors">Sectors</TabsTrigger>
          <TabsTrigger value="long-only">Long-only</TabsTrigger>
          <TabsTrigger value="long-short">Long/short</TabsTrigger>
          <TabsTrigger value="stress">Stress test</TabsTrigger>
          <TabsTrigger value="method">Method</TabsTrigger>
        </TabsList>
        <TabsContent value="sectors">
          <SectorsTab view={view} />
        </TabsContent>
        <TabsContent value="long-only">
          <LongOnlyTab view={view} highlight={highlight} />
        </TabsContent>
        <TabsContent value="long-short">
          <LongShortTab view={view} highlight={highlight} />
        </TabsContent>
        <TabsContent value="stress">
          <StressTab data={data} view={view} stress={currentStress} onResult={(result) => setStress({ key, result })} />
        </TabsContent>
        <TabsContent value="method">
          <MethodTab data={data} view={view} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
