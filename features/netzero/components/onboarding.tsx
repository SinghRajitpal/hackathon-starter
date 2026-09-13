"use client";

import { useState } from "react";

import { Panel } from "@/features/netzero/components/frame";
import type { MacPoint } from "@/features/netzero/engine/config";
import { parseCapitalInput } from "@/features/netzero/engine/portfolio";
import type { AdjustControls, RiskAnswers, TrailTolerance } from "@/features/netzero/engine/dashboard/types";

const TRAIL_OPTIONS: { value: TrailTolerance; label: string }[] = [
  { value: "low", label: "Under 1% (Conservative)" },
  { value: "medium", label: "Up to 3% (Balanced)" },
  { value: "high", label: "More than 3% (Aggressive)" },
];

const MAC_OPTIONS: { value: MacPoint; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
];

export function Onboarding({
  answers,
  adjust,
  onAnswers,
  onAdjust,
}: {
  answers: RiskAnswers;
  adjust: AdjustControls;
  onAnswers(answers: RiskAnswers): void;
  onAdjust(adjust: AdjustControls): void;
}) {
  const [pending, setPending] = useState<RiskAnswers>(answers);
  const [capitalInput, setCapitalInput] = useState(String(adjust.capital));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Panel title="Risk appetite">
        <form
          className="flex flex-col gap-3 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            onAnswers(pending);
          }}
        >
          <fieldset>
            <legend className="mb-1 text-xs font-medium">How far may the fund trail the S&amp;P 500 in a bad year?</legend>
            <div className="flex flex-col gap-1">
              {TRAIL_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="trail"
                    value={o.value}
                    checked={pending.trail === o.value}
                    onChange={() => setPending({ ...pending, trail: o.value })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pending.allowShorts}
              onChange={(e) => setPending({ ...pending, allowShorts: e.target.checked })}
            />
            May the fund short stocks?
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pending.robustOnly}
              onChange={(e) => setPending({ ...pending, robustOnly: e.target.checked })}
            />
            Only trade picks that hold if cleanup costs are 50% off?
          </label>
          <button type="submit" className="self-start rounded border px-3 py-1 font-mono text-xs">
            Apply
          </button>
        </form>
      </Panel>
      <Panel title="Adjust">
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Capital (USD)
            <input
              type="text"
              inputMode="decimal"
              value={capitalInput}
              onChange={(e) => {
                setCapitalInput(e.target.value);
                const capital = parseCapitalInput(e.target.value);
                if (capital !== null) onAdjust({ ...adjust, capital });
              }}
              className="w-48 rounded border bg-background px-2 py-1 font-mono text-sm"
            />
          </label>
          <fieldset>
            <legend className="mb-1 text-xs font-medium">Cost scenario</legend>
            <div className="flex gap-3">
              {MAC_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="macPoint"
                    value={o.value}
                    checked={adjust.macPoint === o.value}
                    onChange={() => onAdjust({ ...adjust, macPoint: o.value })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Panel>
    </div>
  );
}
