import type { Metadata } from "next";

import { TickerSearch } from "@/components/app/ticker-search";

export const metadata: Metadata = { title: "Dashboard · Meridian" };

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 pb-24">
      <div className="max-w-2xl text-center">
        <h1 className="font-serif text-5xl leading-tight sm:text-6xl">Look up a company</h1>
        <p className="mt-3 text-muted-foreground">
          Search any S&amp;P 500 ticker or company name to see its sustainability score and its net-zero scenario side
          by side.
        </p>
      </div>
      <TickerSearch />
    </div>
  );
}
