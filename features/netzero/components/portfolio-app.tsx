"use client";

import { useMemo, useState } from "react";

import { PortfolioScreen } from "@/features/netzero/components/portfolio-screen";
import { useRouterNav } from "@/features/netzero/components/router-nav";
import { buildDashboardModel, DEFAULT_ADJUST } from "@/features/netzero/engine/dashboard/model";
import { DEFAULT_ANSWERS } from "@/features/netzero/engine/dashboard/presets";
import type { AdjustControls, RiskAnswers } from "@/features/netzero/engine/dashboard/types";
import type { ScenarioData } from "@/features/netzero/engine/types";

/** Tool 2's PORTFOLIO screen with the risk-preset state its dashboard shell used to hold. */
export function PortfolioApp({ data }: { data: ScenarioData }) {
  const [answers, setAnswers] = useState<RiskAnswers>(DEFAULT_ANSWERS);
  const [adjust, setAdjust] = useState<AdjustControls>(DEFAULT_ADJUST);
  const nav = useRouterNav();
  const model = useMemo(
    () => (data.error ? null : buildDashboardModel(data, answers, adjust)),
    [data, answers, adjust],
  );

  if (!model) {
    return <div className="rounded-md border border-destructive p-4 text-sm">Could not load scenario data: {data.error}</div>;
  }
  return <PortfolioScreen data={data} model={model} nav={nav} onAnswers={setAnswers} onAdjust={setAdjust} />;
}
