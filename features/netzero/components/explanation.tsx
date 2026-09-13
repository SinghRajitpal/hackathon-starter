"use client";

import { useEffect, useMemo, useState } from "react";

import { Panel, Pill } from "@/features/netzero/components/frame";
import { fallbackExplanation } from "@/features/netzero/explain/fallback";
import { requestBody, resolvePacket, type ExplainTarget } from "@/features/netzero/explain/request";
import type {
  CompanyExplanation,
  ExplainResponse,
  ExplanationPayload,
  MarketExplanation,
  PortfolioExplanation,
  SectorExplanation,
  VerdictBand,
} from "@/features/netzero/explain/types";
import type { DashboardModel, Tone } from "@/features/netzero/engine/dashboard/types";
import type { ScenarioData } from "@/features/netzero/engine/types";

const VERDICT_TONE: Record<VerdictBand, Tone> = { BUY: "good", HOLD: "neutral", SELL: "bad" };

/** Rendered from the tool's own verdict band, so it never waits on Gemini. */
export function VerdictPill({ band }: { band: VerdictBand }) {
  return <Pill text={`Verdict: ${band}`} tone={VERDICT_TONE[band]} />;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}

function Label({ children }: { children: string }) {
  return <h4 className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

function Body({ scope, explanation }: { scope: ExplainTarget["scope"]; explanation: ExplanationPayload }) {
  switch (scope) {
    case "company": {
      const e = explanation as CompanyExplanation;
      return (
        <>
          <p className="font-medium">{e.verdict_line}</p>
          <Bullets items={e.key_drivers} />
          <p>{e.rationale}</p>
          {e.caveat && <p className="text-muted-foreground">{e.caveat}</p>}
        </>
      );
    }
    case "sector": {
      const e = explanation as SectorExplanation;
      return (
        <>
          <p className="font-medium">{e.headline}</p>
          <Bullets items={e.takeaways} />
          <p>{e.pickability}</p>
        </>
      );
    }
    case "market": {
      const e = explanation as MarketExplanation;
      return (
        <>
          <p className="font-medium">{e.headline}</p>
          <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
            <div>
              <Label>Heaviest hit</Label>
              <Bullets items={e.heaviest_hit} />
            </div>
            <div>
              <Label>Least affected</Label>
              <Bullets items={e.least_affected} />
            </div>
          </div>
          <Label>Where to pick</Label>
          <p>{e.where_to_pick}</p>
        </>
      );
    }
    case "portfolio": {
      const e = explanation as PortfolioExplanation;
      return (
        <>
          <p className="font-medium">{e.headline}</p>
          <Label>Longs</Label>
          <p>{e.long_thesis}</p>
          <Label>Shorts and underweights</Label>
          <p>{e.short_thesis}</p>
          <Label>Risk</Label>
          <p>{e.risk_note}</p>
        </>
      );
    }
  }
}

function Skeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2" aria-label="Loading explanation">
      <div className="h-3 w-2/3 rounded bg-muted" />
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-5/6 rounded bg-muted" />
    </div>
  );
}

/**
 * Plain-English caption under a screen's numbers. Sends only identifiers to /api/explain; if the call
 * fails, it shows the same deterministic fallback the server would, built from the engine run in memory.
 */
export function ExplanationPanel({ target, data, model }: { target: ExplainTarget; data: ScenarioData; model: DashboardModel }) {
  const body = JSON.stringify(requestBody(target, { answers: model.answers, macPoint: model.adjust.macPoint }));
  const [result, setResult] = useState<{ body: string; response: ExplainResponse | null } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<ExplainResponse>) : null))
      .then((response) => setResult({ body, response }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ body, response: null });
      });
    return () => controller.abort();
  }, [body]);

  const settled = result !== null && result.body === body;
  const response = settled ? result.response : null;
  const localFallback = useMemo(() => {
    if (!settled || response) return null;
    const packet = resolvePacket(target, data, model, new Date(0));
    return packet ? fallbackExplanation(packet) : null;
    // target is rebuilt every render; body identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, response, body, data, model]);

  const explanation = response?.explanation ?? localFallback;
  const fromGemini = response !== null && response.source !== "fallback";

  return (
    <Panel title="Explanation">
      <div className="flex flex-col gap-1 text-sm">
        {!settled ? <Skeleton /> : explanation ? <Body scope={target.scope} explanation={explanation} /> : null}
        {settled && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {fromGemini
              ? "Explained by Gemini from this tool's computed values"
              : "Summary assembled from this tool's computed values (Gemini unavailable)"}
          </p>
        )}
      </div>
    </Panel>
  );
}
