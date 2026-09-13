import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SplitPanes } from "@/components/app/split-panes";
import { getNetZeroScenario } from "@/features/netzero";
import { NetZeroCompanyPane } from "@/features/netzero/components/company-pane";
import { getSustainabilityScore } from "@/features/sustainability";
import { SustainabilityAnalysisPane } from "@/features/sustainability/components/analysis-pane";

type Params = Promise<{ symbol: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${decodeURIComponent(symbol).toUpperCase()} · Meridian` };
}

export default function TickerPage({ params }: { params: Params }) {
  return (
    // Header (4rem) and main padding (3rem) sit outside; only the two panes scroll.
    <div className="flex h-[calc(100dvh-7rem)] min-h-[32rem] flex-col gap-4">
      <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading company…</p>}>
        <TickerContent params={params} />
      </Suspense>
    </div>
  );
}

async function TickerContent({ params }: { params: Params }) {
  const { symbol } = await params;
  const ticker = decodeURIComponent(symbol).trim().toUpperCase();
  const [sustainability, netZero] = await Promise.all([getSustainabilityScore(ticker), getNetZeroScenario(ticker)]);
  if (!sustainability && !netZero.inUniverse) notFound();

  const nzCompany = netZero.data.companies.find((c) => c.ticker === ticker);
  const name = sustainability?.company_name ?? nzCompany?.companyName ?? ticker;
  const sector = sustainability?.sector ?? nzCompany?.sector;

  return (
    <>
      <header className="shrink-0 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          {ticker}
          {sector ? ` · ${sector}` : ""}
        </p>
      </header>
      <SplitPanes
        className="flex-1"
        leftLabel="Sustainability score"
        rightLabel="Net-zero scenario"
        left={
          sustainability ? (
            <SustainabilityAnalysisPane row={sustainability} />
          ) : (
            <p className="text-sm text-muted-foreground">{ticker} has no sustainability score.</p>
          )
        }
        right={<NetZeroCompanyPane result={netZero} />}
      />
    </>
  );
}
