import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getNetZeroData } from "@/features/netzero";
import { PortfolioApp } from "@/features/netzero/components/portfolio-app";

export const metadata: Metadata = { title: "Net-zero portfolio · Meridian" };

export default function PortfolioPage() {
  return (
    <Suspense fallback={<p className="font-mono text-sm text-muted-foreground">Loading scenario data…</p>}>
      <PortfolioContent />
    </Suspense>
  );
}

async function PortfolioContent() {
  await connection();
  return <PortfolioApp data={await getNetZeroData()} />;
}
