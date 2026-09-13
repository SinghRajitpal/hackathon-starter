"use client";

import { useMemo } from "react";

import { MarketScreen } from "@/features/netzero/components/market-screen";
import { useRouterNav } from "@/features/netzero/components/router-nav";
import { SectorScreen } from "@/features/netzero/components/sector-screen";
import { buildDashboardModel } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import type { ScenarioData } from "@/features/netzero/engine/types";

/** Balanced-preset model for Tool 2's read-only screens, built in the browser like its dashboard did. */
function useBalancedModel(data: ScenarioData) {
  return useMemo(() => (data.error ? null : buildDashboardModel(data, DEFAULT_ANSWERS)), [data]);
}

function LoadError({ message }: { message: string | null }) {
  return <div className="rounded-md border border-destructive p-4 text-sm">Could not load scenario data: {message}</div>;
}

/** Tool 2's MARKET screen: every sector, grouped by how hard net zero hits it. */
export function NetZeroMarketApp({ data }: { data: ScenarioData }) {
  const nav = useRouterNav();
  const model = useBalancedModel(data);
  if (!model) return <LoadError message={data.error} />;
  return <MarketScreen data={data} model={model} nav={nav} />;
}

/** Tool 2's SECTOR screen: who wins and who loses inside one sector. */
export function NetZeroSectorApp({ data, sector }: { data: ScenarioData; sector: string }) {
  const nav = useRouterNav();
  const model = useBalancedModel(data);
  if (!model) return <LoadError message={data.error} />;
  return <SectorScreen data={data} model={model} nav={nav} sector={sector} />;
}
