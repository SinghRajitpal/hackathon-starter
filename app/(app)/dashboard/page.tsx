import type { Metadata } from "next";

import { TickerSearch } from "@/components/app/ticker-search";

export const metadata: Metadata = { title: "Dashboard · Meridian" };

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 pb-24">
      <div className="max-w-5xl text-center">
        <h1 className="font-serif text-6xl leading-tight sm:text-7xl">Look up a company</h1>
        <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
          Search any S&amp;P 500 ticker or company name to see its sustainability score and its net-zero scenario side
          by side.
        </p>
      </div>
      <TickerSearch />
    </div>
  );
}
