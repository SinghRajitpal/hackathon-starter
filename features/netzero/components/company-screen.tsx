"use client";

import { ExplanationPanel, VerdictPill } from "@/features/netzero/components/explanation";
import { KpiTiles, Panel, Pill, ScreenHeader, Takeaways } from "@/features/netzero/components/frame";
import { verdictForTicker } from "@/features/netzero/explain/verdict";
import { buildCompanyView } from "@/features/netzero/engine/dashboard/company";
import { formatUsd } from "@/features/netzero/engine/format";
import { COMPANY_LABEL_TONE } from "@/features/netzero/engine/dashboard/labels";
import type { ScreenProps } from "@/features/netzero/engine/dashboard/types";

const ROBUST_TEXT: Record<"holds" | "does-not-hold" | "no-position", string> = {
  holds: "Holds under ±50% costs",
  "does-not-hold": "Does not hold under ±50% costs",
  "no-position": "No position to stress",
};

const DATA_TEXT: Record<"reported" | "estimated", string> = { reported: "Data: reported", estimated: "Data: estimated" };

export function CompanyScreen({ data, model, nav, ticker }: ScreenProps & { ticker: string | null }) {
  if (!ticker) {
    return <ScreenHeader title="Company" subtitle="Type a ticker in the command box above to open a company." />;
  }

  const view = buildCompanyView(data, model, ticker);
  if (!view) {
    return <ScreenHeader title={ticker} subtitle={`${ticker} is not in the S&P 500 scenario universe.`} />;
  }

  const { header, tiles, billSplit, peers, reason, stance, badges, takeaways } = view;
  const verdict = verdictForTicker(model, ticker);

  return (
    <div className="flex flex-col gap-3">
      <ScreenHeader
        title={`${header.ticker} · ${header.name}`}
        subtitle={`${header.verdictText} · score ${header.score.toFixed(1)} · rank ${header.rank}/${header.sectorSize}`}
        right={
          <button
            type="button"
            onClick={() => nav.openSector(header.sector)}
            className="rounded border px-2 py-1 font-mono text-xs hover:bg-muted"
          >
            {header.sector} {"→"}
          </button>
        }
      />
      <KpiTiles tiles={tiles} />
      <div className="flex flex-wrap gap-2">
        {verdict && <VerdictPill band={verdict.band} />}
        <Pill text={ROBUST_TEXT[badges.robust]} tone={badges.robust === "holds" ? "good" : badges.robust === "does-not-hold" ? "bad" : "neutral"} />
        <Pill text={DATA_TEXT[badges.data]} tone={badges.data === "estimated" ? "warn" : "neutral"} />
        <Pill text={stance} tone={COMPANY_LABEL_TONE[header.label]} />
      </div>
      <Panel title="Cleanup bill by source">
        <table className="w-full text-left text-sm">
          <tbody>
            {billSplit.map((row) => (
              <tr key={row.category} className="border-b last:border-0">
                <td className="py-1 pr-3 text-muted-foreground">{row.label}</td>
                <td className="py-1 text-right font-mono tabular-nums">{formatUsd(row.usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Why">
        <p className="text-sm">{reason}</p>
      </Panel>
      <Panel title={`${header.sector} peers`}>
        <div className="flex flex-wrap gap-1.5">
          {peers.map((p) => (
            <button
              key={p.ticker}
              type="button"
              onClick={() => nav.openCompany(p.ticker)}
              className={`rounded border px-2 py-1 font-mono text-xs ${p.isSelf ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {p.ticker}
            </button>
          ))}
        </div>
      </Panel>
      <Takeaways items={takeaways} />
      <ExplanationPanel target={{ scope: "company", ticker: header.ticker }} data={data} model={model} />
    </div>
  );
}
