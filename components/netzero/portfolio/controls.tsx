"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MacPoint } from "@/lib/netzero/config";
import { parseCapitalInput, type PortfolioControls } from "@/lib/netzero/portfolio";
import type { Mandate } from "@/lib/netzero/types";

export function Controls({
  value,
  onChange,
}: {
  value: PortfolioControls;
  onChange: (next: PortfolioControls) => void;
}) {
  const set = <K extends keyof PortfolioControls>(key: K, next: PortfolioControls[K]) => onChange({ ...value, [key]: next });

  return (
    <TooltipProvider>
      <section className="grid gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="capital">Capital (USD)</Label>
          <Input
            id="capital"
            type="number"
            min={0}
            step={1_000_000}
            value={value.capital}
            onChange={(e) => {
              const n = parseCapitalInput(e.target.value);
              if (n !== null) set("capital", n);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Mandate</Label>
          <Select value={value.mandate} onValueChange={(v) => set("mandate", v as Mandate)}>
            <SelectTrigger aria-label="Mandate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="long-only">Long-only tilt (default)</SelectItem>
              <SelectItem value="long-short">Sector-neutral long/short</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Abatement cost scenario</Label>
          <Select value={value.macPoint} onValueChange={(v) => set("macPoint", v as MacPoint)}>
            <SelectTrigger aria-label="Abatement cost scenario">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low costs</SelectItem>
              <SelectItem value="mid">Mid-point costs (base)</SelectItem>
              <SelectItem value="high">High costs</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium">TBR IQR threshold: {value.tbrIqrThreshold.toFixed(2)} yrs</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              A sector is tradeable if the gap between a well-placed and a badly-placed peer exceeds this many years of
              EBITDA (PDF §8, default 0.25).
            </TooltipContent>
          </Tooltip>
          <Slider
            aria-label="TBR IQR threshold"
            min={0}
            max={2}
            step={0.05}
            value={[value.tbrIqrThreshold]}
            onValueChange={([v]) => set("tbrIqrThreshold", v)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm font-medium">Score IQR threshold: {value.scoreIqrThreshold.toFixed(0)} pts</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Or tradeable if the interquartile range of the scenario score exceeds this (PDF §8, default 25).
            </TooltipContent>
          </Tooltip>
          <Slider
            aria-label="Score IQR threshold"
            min={0}
            max={60}
            step={1}
            value={[value.scoreIqrThreshold]}
            onValueChange={([v]) => set("scoreIqrThreshold", v)}
          />
        </div>
      </section>
    </TooltipProvider>
  );
}
