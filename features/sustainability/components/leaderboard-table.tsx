import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ScoreRow } from "@/features/sustainability/types";

export function pillarShares(row: Pick<ScoreRow,
  | "weight_env_intensity"
  | "weight_esg_risk"
  | "weight_controversy"
  | "weight_asset_turnover"
  | "weight_profit_margin"
  | "weight_fcf_margin"
  | "weight_leverage"
>) {
  const environmental = row.weight_env_intensity;
  const social = row.weight_esg_risk + row.weight_controversy;
  const financial = row.weight_asset_turnover + row.weight_profit_margin + row.weight_fcf_margin + row.weight_leverage;
  return { environmental, social, financial };
}

export function LeaderboardTable({ rows, useSectorRank = false }: { rows: ScoreRow[]; useSectorRank?: boolean }) {
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Ticker</th>
            <th className="px-3 py-2 text-left">Company</th>
            <th className="px-3 py-2 text-left">Sector</th>
            <th className="px-3 py-2 text-right">Environmental</th>
            <th className="px-3 py-2 text-right">Social</th>
            <th className="px-3 py-2 text-right">Financial</th>
            <th className="px-3 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.ticker} className="hover:bg-accent">
              <td className="px-3 py-2 font-mono">{useSectorRank ? row.sector_rank : row.rank}</td>
              <td className="px-3 py-2">
                <Link href={`/ticker/${encodeURIComponent(row.ticker)}`}>
                  <Badge>{row.ticker}</Badge>
                </Link>
              </td>
              <td className="px-3 py-2">{row.company_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.sector}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.pillar_environmental_score.toFixed(0)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.pillar_social_score.toFixed(0)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{row.pillar_financial_score.toFixed(0)}</td>
              <td className="px-3 py-2 text-right font-semibold">{row.score.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
