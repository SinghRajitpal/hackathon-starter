import type { PortfolioView } from "@/lib/netzero/portfolio";

export function LongOnlyTab({ view }: { view: PortfolioView; highlight: string | null }) {
  return <p className="text-sm">{view.longOnlyRows.length} names</p>;
}
