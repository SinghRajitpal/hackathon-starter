"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GeminiAnalysis } from "@/lib/gemini/schema";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; analysis: GeminiAnalysis };

// Client component: fetches the AI narration layer after the page's
// quantitative content (score, rank, decomposition -- all server-
// rendered by CompanyDetail) has already loaded. Failing here never
// breaks the rest of the page -- worst case this card shows an error
// message while everything above it keeps working.
export function GeminiAnalysisCard({ ticker }: { ticker: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    fetch("/api/sustainability-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
        return body as GeminiAnalysis;
      })
      .then((analysis) => {
        if (!cancelled) setState({ status: "ready", analysis });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: "error", message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-normal">Generating AI analysis...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground font-normal">
            AI analysis unavailable ({state.message})
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const { analysis } = state;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        AI Analysis -- Gemini&apos;s read of the model above, not a second score
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-2">
          <div className="text-sm font-semibold">Sustainability thesis</div>
          <p className="text-sm">{analysis.sustainability_thesis}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Company overview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>{analysis.company_overview.business}</p>
          <p>{analysis.company_overview.competitive_context}</p>
          <p>{analysis.company_overview.strategic_context}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pillar analysis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div>
            <div className="font-semibold text-xs text-muted-foreground mb-1">Environmental</div>
            <p>{analysis.pillar_analysis.environmental}</p>
          </div>
          <div>
            <div className="font-semibold text-xs text-muted-foreground mb-1">Social</div>
            <p>{analysis.pillar_analysis.social}</p>
          </div>
          <div>
            <div className="font-semibold text-xs text-muted-foreground mb-1">Finance & Operations</div>
            <p>{analysis.pillar_analysis.finance_operations}</p>
          </div>
          <div className="pt-2 border-t">
            <div className="font-semibold text-xs text-muted-foreground mb-1">Overall</div>
            <p>{analysis.overall_analysis}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Leaderboard position -- #{analysis.leaderboard_position.rank} of {analysis.leaderboard_position.total_companies}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>{analysis.leaderboard_position.explanation}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Distance to ideal</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>{analysis.distance_to_ideal.summary}</p>
          <p className="text-muted-foreground">{analysis.distance_to_ideal.key_drivers}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm list-disc pl-4 flex flex-col gap-1">
              {analysis.key_strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key weaknesses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm list-disc pl-4 flex flex-col gap-1">
              {analysis.key_weaknesses.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key trade-offs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm list-disc pl-4 flex flex-col gap-1">
              {analysis.key_tradeoffs.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
