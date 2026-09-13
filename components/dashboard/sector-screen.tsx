"use client";

import { ScreenHeader } from "@/components/dashboard/frame";
import type { ScreenProps } from "@/lib/netzero/dashboard/types";

/** Placeholder — replaced by the MARKET/SECTOR task. */
export function SectorScreen({ sector }: ScreenProps & { sector: string | null }) {
  return <ScreenHeader title={sector ?? "Sector"} subtitle="Who wins and who loses inside the industry?" />;
}
