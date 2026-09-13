import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { RankingsPicker } from "@/components/app/rankings-picker";
import { SplitPanes } from "@/components/app/split-panes";
import { getNetZeroRanking } from "@/features/netzero";
import { NetZeroRankingTable } from "@/features/netzero/components/ranking-table";
import { getSustainabilityRanking } from "@/features/sustainability";
import { LeaderboardTable } from "@/features/sustainability/components/leaderboard-table";
import { groupByLetter, parseRankingView } from "@/lib/tickers";

export const metadata: Metadata = { title: "Tickers · Meridian" };

type SearchParams = Promise<{ ranking?: string | string[] }>;

const loading = <p className="text-sm text-muted-foreground">Loading…</p>;

export default function TickersPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-serif text-4xl">Tickers overview</h1>
        <p className="mt-1 text-muted-foreground">Every S&amp;P 500 company from A to Z, and the rankings from both tools.</p>
      </header>
      {/* The A–Z index only sits beside the leaderboard on wide screens; below that it moves under it so the rankings get the full width. */}
      <div className="grid gap-6 2xl:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="All tickers A to Z"
          className="order-2 max-h-[50dvh] overflow-y-auto rounded-lg border bg-card p-4 2xl:sticky 2xl:top-20 2xl:order-none 2xl:max-h-[calc(100dvh-7rem)]"
        >
          <Suspense fallback={loading}>
            <TickerIndex />
          </Suspense>
        </nav>
        <section aria-labelledby="leaderboard-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="leaderboard-heading" className="sr-only">
            Leaderboard
          </h2>
          <RankingsPicker />
          <Suspense fallback={loading}>
            <Leaderboard searchParams={searchParams} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

async function TickerIndex() {
  await connection();
  const groups = groupByLetter(await getSustainabilityRanking());

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ letter, items }) => (
        <section key={letter} aria-labelledby={`letter-${letter}`}>
          <h3 id={`letter-${letter}`} className="mb-1 text-xs font-semibold text-muted-foreground">
            {letter}
          </h3>
          <ul>
            {items.map((c) => (
              <li key={c.ticker}>
                <Link
                  href={`/ticker/${encodeURIComponent(c.ticker)}`}
                  className="flex gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                >
                  <span className="w-14 shrink-0 font-mono font-semibold">{c.ticker}</span>
                  <span className="truncate text-muted-foreground">{c.company_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

async function Leaderboard({ searchParams }: { searchParams: SearchParams }) {
  const view = parseRankingView((await searchParams).ranking);

  if (view === null) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        Pick a ranking with See Rankings to fill the leaderboard.
      </div>
    );
  }
  if (view === "sustainability") {
    return <LeaderboardTable rows={await getSustainabilityRanking()} />;
  }
  if (view === "netzero") {
    return <NetZeroRankingTable rows={await getNetZeroRanking()} />;
  }

  const [sustainability, netZero] = await Promise.all([getSustainabilityRanking(), getNetZeroRanking()]);
  return (
    <SplitPanes
      className="h-[75dvh] min-h-[28rem]"
      leftLabel="Current sustainability ranking"
      rightLabel="Net-zero scenario ranking"
      left={<LeaderboardTable rows={sustainability} compact />}
      right={<NetZeroRankingTable rows={netZero} />}
    />
  );
}
