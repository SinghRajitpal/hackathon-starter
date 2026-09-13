"use client";

import { ExplanationPanel } from "@/features/netzero/components/explanation";
import { KpiTiles, Panel, Pill, ScreenHeader, Takeaways } from "@/features/netzero/components/frame";
import { formatPercent, formatYears } from "@/features/netzero/engine/format";
import { SECTOR_VERDICT_TEXT, SECTOR_VERDICT_TONE } from "@/features/netzero/engine/dashboard/labels";
import { buildMarketView } from "@/features/netzero/engine/dashboard/market";
import type { ScreenProps } from "@/features/netzero/engine/dashboard/types";

export function MarketScreen({ data, model, nav }: ScreenProps) {
  const { tiles, rows, takeaways } = buildMarketView(data, model);

  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader title="Market" subtitle="Where does the net-zero shock hit?" />
      <KpiTiles tiles={tiles} />
      <Panel title="Sectors">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              <th className="py-1 pr-2">Sector</th>
              <th className="py-1 pr-2 text-right">Companies</th>
              <th className="py-1 pr-2 text-right">Cleanup cost</th>
              <th className="py-1 pr-2 text-right">Fossil %</th>
              <th className="py-1 pr-2 text-right">Green %</th>
              <th className="py-1 pr-2 text-right">Winner/loser gap</th>
              <th className="py-1 pr-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.sector}
                onClick={() => nav.openSector(r.sector)}
                className="cursor-pointer border-t hover:bg-muted/50"
              >
                <td className="py-1 pr-2 font-medium">{r.sector}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.n}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatYears(r.cleanupYears)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatPercent(r.fossilShare)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatPercent(r.greenShare)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatYears(r.gapYears)}</td>
                <td className="py-1 pr-2">
                  <Pill text={SECTOR_VERDICT_TEXT[r.verdict]} tone={SECTOR_VERDICT_TONE[r.verdict]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Takeaways items={takeaways} />
      <ExplanationPanel target={{ scope: "market" }} data={data} model={model} />
    </div>
  );
}
