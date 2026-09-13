import Link from "next/link";

import { COMPANY_LABEL_TEXT, COMPANY_LABEL_TONE, TONE_CLASS } from "@/features/netzero/engine/dashboard/labels";
import type { VerdictBand } from "@/features/netzero/explain/types";
import { sectorAnchor, type NetZeroRankingRow } from "@/features/netzero/ranking";

const VERDICT_CLASS: Record<VerdictBand, string> = {
  BUY: TONE_CLASS.good,
  HOLD: TONE_CLASS.neutral,
  SELL: TONE_CLASS.bad,
};

export function NetZeroRankingTable({ rows }: { rows: NetZeroRankingRow[] }) {
  const sectors = Map.groupBy(rows, (r) => r.sector);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Balanced preset (the PDF defaults). Scores are normalised inside each sector, so a rank only compares companies
        in the same sector.
      </p>
      {[...sectors].map(([sector, sectorRows]) => (
        <section key={sector} id={sectorAnchor(sector)} className="scroll-mt-20">
          <h3 className="mb-2 text-sm font-semibold">
            {sector} <span className="font-normal text-muted-foreground">· {sectorRows.length} companies</span>
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Rank</th>
                  <th className="px-3 py-2 text-left">Ticker</th>
                  <th className="px-3 py-2 text-left">Company</th>
                  <th className="px-3 py-2 text-right">Score</th>
                  <th className="px-3 py-2 text-left">Position</th>
                  <th className="px-3 py-2 text-left">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sectorRows.map((r) => (
                  <tr key={r.ticker} className="hover:bg-accent">
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {r.rank}/{r.sectorSize}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/ticker/${encodeURIComponent(r.ticker)}`} className="font-mono font-semibold hover:underline">
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.companyName}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.score.toFixed(1)}</td>
                    <td className={`px-3 py-2 ${TONE_CLASS[COMPANY_LABEL_TONE[r.label]]}`}>{COMPANY_LABEL_TEXT[r.label]}</td>
                    <td className={`px-3 py-2 font-mono ${r.verdict ? VERDICT_CLASS[r.verdict] : "text-muted-foreground"}`}>
                      {r.verdict ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
