import type { Metadata } from "next";

export const metadata: Metadata = { title: "Market overview · Meridian" };

// Placeholder: Market Overview has no content spec yet.
export default function MarketPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Market overview</h1>
      <p className="max-w-md text-muted-foreground">Coming soon.</p>
    </div>
  );
}
