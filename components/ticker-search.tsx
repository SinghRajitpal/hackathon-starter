"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Company = { ticker: string; company_name: string };

const MAX_RESULTS = 10;

export function TickerSearch() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("sp500_esg_zscores")
      .select("ticker, company_name")
      .order("ticker")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setCompanies(data ?? []);
      });
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? companies
        .filter(
          (c) =>
            c.ticker.toLowerCase().includes(q) ||
            c.company_name.toLowerCase().includes(q),
        )
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className="w-full max-w-xl flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          placeholder="Search S&P 500 tickers..."
          aria-label="Search S&P 500 tickers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="rounded-md border divide-y">
            {results.map((c) => (
              <li key={c.ticker}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(c.ticker);
                    setQuery("");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                >
                  <span className="rounded bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground">
                    {c.ticker}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {c.company_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{selected}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
      )}
    </div>
  );
}
