import type { PortfolioView } from "@/lib/netzero/portfolio";

export function LongShortTab({ view }: { view: PortfolioView; highlight: string | null }) {
  return <p className="text-sm">{view.longShortRows.length} positions</p>;
}
