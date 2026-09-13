"use client";

import { KpiTiles, Panel, ScreenHeader, Takeaways } from "@/components/dashboard/frame";
import { Onboarding } from "@/components/dashboard/onboarding";
import { formatPercent, formatUsd, formatYears } from "@/lib/netzero/format";
import { buildPortfolioDashboard, type ComparisonFormat } from "@/lib/netzero/dashboard/portfolio";
import type { AdjustControls, RiskAnswers, ScreenProps } from "@/lib/netzero/dashboard/types";

export type PortfolioScreenProps = ScreenProps & {
  onAnswers(answers: RiskAnswers): void;
  onAdjust(adjust: AdjustControls): void;
};

function formatComparison(format: ComparisonFormat, value: number): string {
  if (format === "years") return formatYears(value);
  if (format === "percent") return formatPercent(value);
  return formatUsd(value);
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "portfolio.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function PortfolioScreen({ data, model, nav, onAnswers, onAdjust }: PortfolioScreenProps) {
  const view = buildPortfolioDashboard(data, model);

  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader
        title="Portfolio"
        subtitle={`Preset: ${model.preset.label} · active limit ±${(model.preset.activeLimit * 100).toFixed(0)}pp`}
      />
      <Onboarding answers={model.answers} adjust={model.adjust} onAnswers={onAnswers} onAdjust={onAdjust} />
      <KpiTiles tiles={view.tiles} />
      <Panel
        title="Portfolio vs S&P 500 vs exclusion"
        right={
          <button type="button" onClick={() => downloadCsv(view.csv)} className="rounded border px-2 py-1 font-mono text-[11px]">
            Download CSV
          </button>
        }
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-muted-foreground">
              <th className="py-1">Metric</th>
              <th className="py-1 text-right">Portfolio</th>
              <th className="py-1 text-right">S&amp;P 500</th>
              <th className="py-1 text-right">Exclusion</th>
            </tr>
          </thead>
          <tbody>
            {view.comparison.map((row) => (
              <tr key={row.metric} className="border-t">
                <td className="py-1">{row.metric}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatComparison(row.format, row.portfolio)}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatComparison(row.format, row.benchmark)}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatComparison(row.format, row.exclusion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Where the bets are (weight moved inside each sector)">
        {view.sectorBets.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sector passes the preset threshold: the book holds the S&amp;P 500.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {view.sectorBets.map((b) => (
              <li key={b.sector} className="flex items-center justify-between gap-2">
                <button type="button" className="text-left hover:underline" onClick={() => nav.openSector(b.sector)}>
                  {b.sector}
                </button>
                <span className="font-mono tabular-nums">{b.movedPp.toFixed(2)}pp</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Panel title="Top overweights">
          <OverUnderTable rows={view.overweights} onOpen={nav.openCompany} />
        </Panel>
        <Panel title="Top underweights">
          <OverUnderTable rows={view.underweights} onOpen={nav.openCompany} />
        </Panel>
      </div>
      {view.longShort && (
        <Panel title="Long/short book">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase text-muted-foreground">
                <th className="py-1">Ticker</th>
                <th className="py-1">Side</th>
                <th className="py-1 text-right">Weight</th>
                <th className="py-1 text-right">Dollars</th>
              </tr>
            </thead>
            <tbody>
              {view.longShort.map((r) => (
                <tr key={r.ticker} className="border-t">
                  <td className="py-1">
                    <button type="button" className="hover:underline" onClick={() => nav.openCompany(r.ticker)}>
                      {r.ticker}
                    </button>
                  </td>
                  <td className="py-1">{r.position}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatPercent(Math.abs(r.weight), 2)}</td>
                  <td className="py-1 text-right font-mono tabular-nums">{formatUsd(r.dollars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <Takeaways items={view.takeaways} />
    </div>
  );
}

function OverUnderTable({
  rows,
  onOpen,
}: {
  rows: { ticker: string; name: string; sector: string; activePp: number; dollars: number; reason: string }[];
  onOpen(ticker: string): void;
}) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">None.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-[11px] uppercase text-muted-foreground">
          <th className="py-1">Ticker</th>
          <th className="py-1 text-right">Active</th>
          <th className="py-1 text-right">Dollars</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ticker} className="border-t align-top">
            <td className="py-1">
              <button type="button" className="hover:underline" onClick={() => onOpen(r.ticker)} title={r.reason}>
                {r.ticker}
              </button>
              <div className="text-[11px] text-muted-foreground">{r.name}</div>
            </td>
            <td className="py-1 text-right font-mono tabular-nums">
              {r.activePp >= 0 ? "+" : ""}
              {r.activePp.toFixed(2)}pp
            </td>
            <td className="py-1 text-right font-mono tabular-nums">{formatUsd(r.dollars)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
