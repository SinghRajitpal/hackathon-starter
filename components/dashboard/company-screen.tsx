"use client";

import { ScreenHeader } from "@/components/dashboard/frame";
import type { ScreenProps } from "@/lib/netzero/dashboard/types";

/** Placeholder — replaced by the COMPANY task. */
export function CompanyScreen({ ticker }: ScreenProps & { ticker: string | null }) {
  return <ScreenHeader title={ticker ?? "Company"} subtitle="How hard is it hit, and can it pay?" />;
}
