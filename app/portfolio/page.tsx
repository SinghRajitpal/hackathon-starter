import Link from "next/link";
import { Suspense } from "react";

import { PortfolioApp } from "@/components/netzero/portfolio/portfolio-app";
import { loadScenarioData } from "@/lib/netzero/load";

type PortfolioSearchParams = Promise<{ ticker?: string | string[] }>;

async function PortfolioContent({ searchParams }: { searchParams: PortfolioSearchParams }) {
  const { ticker } = await searchParams;
  const data = await loadScenarioData();
  return <PortfolioApp data={data} highlight={typeof ticker === "string" ? ticker.toUpperCase() : null} />;
}

export default function PortfolioPage({ searchParams }: { searchParams: PortfolioSearchParams }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Ticker search
        </Link>
        <h1 className="text-3xl font-bold">Net-zero portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Tomorrow the world commits to net zero. How should a fund allocate? Sector-neutral books built from the
          within-sector scenario score (PDF §7–§10).
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading scenario data…</p>}>
        <PortfolioContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
