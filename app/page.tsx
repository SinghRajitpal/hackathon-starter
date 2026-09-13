import Link from "next/link";
import { Suspense } from "react";

import { TickerSearch } from "@/components/ticker-search";
import { loadScenarioData } from "@/lib/netzero/load";

type HomeSearchParams = Promise<{ ticker?: string | string[] }>;

async function HomeContent({ searchParams }: { searchParams: HomeSearchParams }) {
  const { ticker } = await searchParams;
  const scenario = await loadScenarioData();
  return (
    <TickerSearch initialTicker={typeof ticker === "string" ? ticker.toUpperCase() : null} scenario={scenario} />
  );
}

export default function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  return (
    <main className="min-h-screen flex flex-col items-center gap-8 px-5 py-16">
      <h1 className="text-4xl font-bold text-center">ETHack</h1>
      <Link
        href="/portfolio"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Open the net-zero portfolio builder →
      </Link>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
