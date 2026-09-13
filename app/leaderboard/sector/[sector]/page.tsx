import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboard-table";

export default async function SectorLeaderboardPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;
  const decodedSector = decodeURIComponent(sector);

  const supabase = await createClient();
  // Same table, same weights, same scores as the universal view -- this
  // is a filter + renumber (order by sector_rank, which 09_score.py
  // already computed from the universal ranking), never a second
  // weighting pass. Blueprint section 9.
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select("*")
    .eq("sector", decodedSector)
    .order("sector_rank", { ascending: true });

  if (error) console.error(error);
  const rows = (data ?? []) as ScoreRow[];
  if (rows.length === 0) notFound();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">{decodedSector}</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} companies in this sector, same scores and weights as the universal leaderboard -- just filtered and renumbered.
      </p>
      <LeaderboardTable rows={rows} useSectorRank />
    </main>
  );
}
