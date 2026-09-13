import { Suspense } from "react";

import { DashboardApp } from "@/components/dashboard/dashboard-app";
import { VIEWS, type View } from "@/lib/netzero/dashboard/types";
import { loadScenarioData } from "@/lib/netzero/load";

type HomeSearchParams = Promise<{ view?: string | string[]; sector?: string | string[]; ticker?: string | string[] }>;

function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function DashboardContent({ searchParams }: { searchParams: HomeSearchParams }) {
  const params = await searchParams;
  const data = await loadScenarioData();
  const ticker = one(params.ticker)?.toUpperCase() ?? null;
  const requested = one(params.view);
  const view: View = VIEWS.includes(requested as View) ? (requested as View) : ticker ? "company" : "market";
  return <DashboardApp data={data} initial={{ view, sector: one(params.sector), ticker }} />;
}

export default function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  return (
    <Suspense fallback={<p className="p-6 font-mono text-sm text-muted-foreground">Loading scenario data…</p>}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
