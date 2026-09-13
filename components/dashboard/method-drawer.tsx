"use client";

import { useMemo } from "react";

import { MethodTab } from "@/components/netzero/portfolio/method-tab";
import { buildPortfolioView, DEFAULT_CONTROLS } from "@/lib/netzero/portfolio";
import type { ScenarioData } from "@/lib/netzero/types";

export function MethodDrawer({ data, onClose }: { data: ScenarioData; onClose(): void }) {
  const view = useMemo(() => buildPortfolioView(data, DEFAULT_CONTROLS), [data]);
  return (
    <div role="dialog" aria-label="Method and limitations" className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-l bg-background p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-mono text-sm font-bold uppercase">Method and limitations</h2>
          <button type="button" onClick={onClose} className="rounded border px-2 py-1 font-mono text-xs">
            Close
          </button>
        </div>
        <MethodTab data={data} view={view} />
      </aside>
    </div>
  );
}
