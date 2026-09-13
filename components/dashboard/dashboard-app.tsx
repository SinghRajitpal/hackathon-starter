"use client";

import { type FormEvent, useCallback, useMemo, useState } from "react";

import { CompanyScreen } from "@/components/dashboard/company-screen";
import { MarketScreen } from "@/components/dashboard/market-screen";
import { MethodDrawer } from "@/components/dashboard/method-drawer";
import { PortfolioScreen } from "@/components/dashboard/portfolio-screen";
import { SectorScreen } from "@/components/dashboard/sector-screen";
import { buildDashboardModel, DEFAULT_ADJUST } from "@/lib/netzero/dashboard/model";
import { DEFAULT_ANSWERS } from "@/lib/netzero/dashboard/presets";
import type { AdjustControls, Nav, RiskAnswers, View } from "@/lib/netzero/dashboard/types";
import { VIEWS } from "@/lib/netzero/dashboard/types";
import type { ScenarioData } from "@/lib/netzero/types";

const VIEW_LABEL: Record<View, string> = { market: "Market", sector: "Sector", company: "Company", portfolio: "Portfolio" };

export interface DashboardInitial {
  view: View;
  sector: string | null;
  ticker: string | null;
}

export function DashboardApp({ data, initial }: { data: ScenarioData; initial: DashboardInitial }) {
  const [view, setView] = useState<View>(initial.view);
  const [sector, setSector] = useState<string | null>(initial.sector);
  const [ticker, setTicker] = useState<string | null>(initial.ticker);
  const [answers, setAnswers] = useState<RiskAnswers>(DEFAULT_ANSWERS);
  const [adjust, setAdjust] = useState<AdjustControls>(DEFAULT_ADJUST);
  const [command, setCommand] = useState("");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);

  const model = useMemo(() => buildDashboardModel(data, answers, adjust), [data, answers, adjust]);
  const sectors = useMemo(() => [...new Set(data.companies.map((c) => c.sector))].sort(), [data]);
  const tickers = useMemo(() => new Map(data.companies.map((c) => [c.ticker, c])), [data]);

  const sync = useCallback((next: DashboardInitial) => {
    const params = new URLSearchParams({ view: next.view });
    if (next.sector) params.set("sector", next.sector);
    if (next.ticker) params.set("ticker", next.ticker);
    window.history.replaceState(null, "", `/?${params.toString()}`);
  }, []);

  const nav: Nav = useMemo(
    () => ({
      openView: (v) => {
        setView(v);
        sync({ view: v, sector, ticker });
      },
      openSector: (s) => {
        setSector(s);
        setView("sector");
        sync({ view: "sector", sector: s, ticker });
      },
      openCompany: (t) => {
        const company = tickers.get(t);
        setTicker(t);
        if (company) setSector(company.sector);
        setView("company");
        sync({ view: "company", sector: company?.sector ?? sector, ticker: t });
      },
    }),
    [sector, ticker, tickers, sync],
  );

  function runCommand(e: FormEvent) {
    e.preventDefault();
    const q = command.trim();
    if (!q) return;
    const upper = q.toUpperCase();
    const sectorMatch = sectors.find((s) => s.toLowerCase() === q.toLowerCase());
    if (tickers.has(upper)) nav.openCompany(upper);
    else if (sectorMatch) nav.openSector(sectorMatch);
    else {
      setCommandError(`No ticker or sector matches "${q}"`);
      return;
    }
    setCommandError(null);
    setCommand("");
  }

  if (data.error) {
    return (
      <div className="m-6 rounded-md border border-destructive p-4 text-sm">
        Could not load scenario data: {data.error}
      </div>
    );
  }

  const screenProps = { data, model, nav };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <span className="font-mono text-sm font-bold tracking-tight">NET-ZERO RISK</span>
        <form onSubmit={runCommand} className="flex items-center gap-2">
          <input
            aria-label="Ticker or sector"
            list="dashboard-commands"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Ticker or sector…"
            className="w-56 rounded border bg-background px-2 py-1 font-mono text-sm uppercase placeholder:normal-case"
          />
          <datalist id="dashboard-commands">
            {sectors.map((s) => (
              <option key={s} value={s} />
            ))}
            {data.companies.map((c) => (
              <option key={c.ticker} value={c.ticker}>
                {c.companyName}
              </option>
            ))}
          </datalist>
        </form>
        <nav className="flex gap-1" aria-label="Screens">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => nav.openView(v)}
              aria-current={view === v ? "page" : undefined}
              className={`rounded px-2 py-1 font-mono text-xs uppercase ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav.openView("portfolio")}
            className="rounded border px-2 py-1 font-mono text-xs"
          >
            Preset: {model.preset.label}
          </button>
          <button
            type="button"
            aria-label="Method and limitations"
            onClick={() => setMethodOpen((o) => !o)}
            className="rounded border px-2 py-1 font-mono text-xs"
          >
            i
          </button>
        </div>
        {commandError && <p className="w-full text-xs text-destructive">{commandError}</p>}
      </header>
      <main className="flex flex-1 flex-col gap-3 p-4">
        {view === "market" && <MarketScreen {...screenProps} />}
        {view === "sector" && <SectorScreen {...screenProps} sector={sector} />}
        {view === "company" && <CompanyScreen {...screenProps} ticker={ticker} />}
        {view === "portfolio" && <PortfolioScreen {...screenProps} onAnswers={setAnswers} onAdjust={setAdjust} />}
      </main>
      {methodOpen && <MethodDrawer data={data} onClose={() => setMethodOpen(false)} />}
    </div>
  );
}
