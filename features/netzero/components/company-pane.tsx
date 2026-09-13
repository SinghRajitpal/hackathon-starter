"use client";

import { useMemo } from "react";

import type { NetZeroResult } from "@/features/netzero";
import { CompanyScreen } from "@/features/netzero/components/company-screen";
import { useRouterNav } from "@/features/netzero/components/router-nav";
import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";

/** Tool 2's company screen for one ticker, scored in the browser with the balanced preset. */
export function NetZeroCompanyPane({ result }: { result: NetZeroResult }) {
  const nav = useRouterNav();
  const model = useMemo(
    () => (result.data.error ? null : buildDashboardModel(result.data, DEFAULT_ANSWERS)),
    [result.data],
  );

  if (!model) {
    return <p className="text-sm text-destructive">Could not load net-zero scenario data: {result.data.error}</p>;
  }
  return <CompanyScreen data={result.data} model={model} nav={nav} ticker={result.ticker} />;
}
