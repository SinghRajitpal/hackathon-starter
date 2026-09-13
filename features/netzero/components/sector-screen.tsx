"use client";

import { ExplanationPanel } from "@/features/netzero/components/explanation";
import { KpiTiles, Panel, Pill, ScreenHeader, Takeaways } from "@/features/netzero/components/frame";
import { formatPercent, formatRatio, formatYears } from "@/features/netzero/engine/format";
import { COMPANY_LABEL_TEXT, COMPANY_LABEL_TONE } from "@/features/netzero/engine/dashboard/labels";
import { buildSectorView } from "@/features/netzero/engine/dashboard/sector";
import type { ScreenProps } from "@/features/netzero/engine/dashboard/types";

export function SectorScreen({ data, model, nav, sector }: ScreenProps & { sector: string | null }) {
  if (sector === null) {
    const sectors = [...new Set(data.companies.map((c) => c.sector))].sort();
    return (
      <div className="flex flex-col gap-3">
        <ScreenHeader title="Sector" subtitle="Who wins and who loses inside the industry?" />
        <Panel title="Pick a sector">
          <ul className="flex flex-col divide-y">
            {sectors.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => nav.openSector(s)}
                  className="w-full py-1.5 text-left text-sm hover:bg-muted/50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    );
  }

  const view = buildSectorView(data, model, sector);
  if (!view) {
    return <ScreenHeader title={sector} subtitle="No companies found for this sector." />;
  }
  const { tiles, rows, takeaways } = view;

  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader title={sector} subtitle="Who wins and who loses inside the industry?" />
      <KpiTiles tiles={tiles} />
      <Panel title="Companies">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              <th className="py-1 pr-2">Ticker</th>
              <th className="py-1 pr-2">Name</th>
              <th className="py-1 pr-2 text-right">Readiness</th>
              <th className="py-1 pr-2 text-right">Cleanup cost</th>
              <th className="py-1 pr-2 text-right">Revenue at risk</th>
              <th className="py-1 pr-2 text-right">Revenue upside</th>
              <th className="py-1 pr-2 text-right">Debt load</th>
              <th className="py-1 pr-2 text-right">Fund action</th>
              <th className="py-1 pr-2">Label</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} onClick={() => nav.openCompany(r.ticker)} className="cursor-pointer border-t hover:bg-muted/50">
                <td className="py-1 pr-2 font-mono font-medium">{r.ticker}</td>
                <td className="py-1 pr-2">{r.name}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{r.score.toFixed(1)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatYears(r.cleanupYears)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatPercent(r.revenueAtRisk)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatPercent(r.revenueUpside)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">{formatRatio(r.debtLoad)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {r.activePp >= 0 ? "+" : ""}
                  {r.activePp.toFixed(1)}pp
                </td>
                <td className="py-1 pr-2">
                  <Pill text={COMPANY_LABEL_TEXT[r.label]} tone={COMPANY_LABEL_TONE[r.label]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Takeaways items={takeaways} />
      <ExplanationPanel target={{ scope: "sector", sector }} data={data} model={model} />
    </div>
  );
}
