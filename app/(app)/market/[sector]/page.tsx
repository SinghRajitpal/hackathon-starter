import type { Metadata } from "next";
import { Suspense } from "react";

import { getNetZeroData } from "@/features/netzero";
import { NetZeroSectorApp } from "@/features/netzero/components/screen-apps";

type Params = Promise<{ sector: string }>;

/** Next.js may hand over the segment still percent-encoded; a stray "%" must not throw. */
function sectorFrom(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sector } = await params;
  return { title: `${sectorFrom(sector)} · Meridian` };
}

export default function SectorPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="font-mono text-sm text-muted-foreground">Loading scenario data…</p>}>
      <SectorContent params={params} />
    </Suspense>
  );
}

async function SectorContent({ params }: { params: Params }) {
  const { sector } = await params;
  return <NetZeroSectorApp data={await getNetZeroData()} sector={sectorFrom(sector)} />;
}
