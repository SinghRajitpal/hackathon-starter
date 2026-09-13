"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useEffect, useId, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { matchTickers, type TickerOption } from "@/lib/tickers";

export function TickerSearch() {
  const router = useRouter();
  const listId = useId();
  const [companies, setCompanies] = useState<TickerOption[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    createClient()
      .from("sp500_esg_scores")
      .select("ticker, company_name")
      .order("ticker")
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setLoadFailed(true);
        }
        setCompanies(data ?? []);
      });
  }, []);

  const results = matchTickers(companies, query);
  const showList = open && results.length > 0;

  function go(ticker: string) {
    setOpen(false);
    router.push(`/ticker/${encodeURIComponent(ticker)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const pick = results[active] ?? results[0];
    if (pick) go(pick.ticker);
    else if (query.trim()) go(query.trim().toUpperCase());
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4">
      <form role="search" onSubmit={onSubmit} className="relative w-full">
        <input
          type="search"
          role="combobox"
          aria-label="Search S&P 500 tickers"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="h-16 w-full rounded-full border bg-card px-7 text-lg shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg"
          >
            {results.map((c, i) => (
              <li
                key={c.ticker}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(c.ticker);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-4 px-6 py-3 ${i === active ? "bg-accent" : ""}`}
              >
                <span className="w-16 shrink-0 font-mono text-sm font-semibold">{c.ticker}</span>
                <span className="truncate text-sm text-muted-foreground">{c.company_name}</span>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>Try</span>
        <button
          type="button"
          onClick={() => go("NVDA")}
          className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-medium text-foreground transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Nvidia
        </button>
      </div>
      {loadFailed && (
        <p className="text-center text-sm text-destructive">Could not load the ticker list. Type a ticker and press Enter.</p>
      )}
    </div>
  );
}
