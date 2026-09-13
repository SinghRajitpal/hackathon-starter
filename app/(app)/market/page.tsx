import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { getNetZeroData } from "@/features/netzero";
import { NetZeroMarketApp } from "@/features/netzero/components/screen-apps";

export const metadata: Metadata = { title: "Market overview · Meridian" };

export default function MarketPage() {
  return (
    <Suspense fallback={<p className="font-mono text-sm text-muted-foreground">Loading scenario data…</p>}>
      <MarketContent />
    </Suspense>
  );
}

async function MarketContent() {
  await connection();
  return <NetZeroMarketApp data={await getNetZeroData()} />;
}
