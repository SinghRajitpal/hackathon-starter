import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboard-table";
import { WeightVector, CorrelationMatrix, type CorrelationRow } from "@/components/weight-and-correlation";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const [{ data, error }, { data: correlationData, error: correlationError }] = await Promise.all([
    supabase.from("sp500_esg_scores").select("*").order("rank", { ascending: true }),
    supabase.from("sp500_esg_correlation").select("*"),
  ]);

  if (error) console.error(error);
  if (correlationError) console.error(correlationError);
  const rows = (data ?? []) as ScoreRow[];
  const correlationRows = (correlationData ?? []) as CorrelationRow[];
  const sectors = [...new Set(rows.map((r) => r.sector))].sort();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Sustainability Leaderboard</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} S&P 500 companies, ranked by sustainability score (0-100).
      </p>

      {rows[0] && <WeightVector weights={rows[0]} />}
      <CorrelationMatrix rows={correlationRows} />

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
