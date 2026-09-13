import type { PortfolioView } from "@/lib/netzero/portfolio";

export function SectorsTab({ view }: { view: PortfolioView }) {
  return <p className="text-sm">{view.result.dispersion.length} sectors</p>;
}
