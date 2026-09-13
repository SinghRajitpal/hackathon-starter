import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboard-table";

const SCORE_COLUMNS =
  "ticker, company_name, sector, score, rank, sector_rank, weight_env_intensity, weight_esg_risk, weight_controversy, weight_asset_turnover, weight_profit_margin, weight_fcf_margin, weight_leverage";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select(SCORE_COLUMNS)
    .order("rank", { ascending: true });

  if (error) console.error(error);
  const rows = (data ?? []) as ScoreRow[];
  const sectors = [...new Set(rows.map((r) => r.sector))].sort();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Sustainability Leaderboard</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} S&P 500 companies, ranked by sustainability score (0-100).
      </p>
      <LeaderboardTable rows={rows} />
      <div className="flex flex-wrap gap-2">
        {sectors.map((sector) => (
          <Link
            key={sector}
            href={`/leaderboard/sector/${encodeURIComponent(sector)}`}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            {sector}
          </Link>
        ))}
      </div>
    </main>
  );
}
