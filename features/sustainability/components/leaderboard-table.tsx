import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export type ScoreRow = {
  ticker: string;
  company_name: string;
  sector: string;
  score: number;
  rank: number;
  sector_rank: number;
  weight_env_intensity: number;
  weight_esg_risk: number;
  weight_controversy: number;
  weight_asset_turnover: number;
  weight_profit_margin: number;
  weight_fcf_margin: number;
  weight_leverage: number;
  pillar_environmental_score: number;
  pillar_social_score: number;
  pillar_financial_score: number;
};

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
                <Link href={`/leaderboard/${row.ticker}`}>
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
