import type { SectorDispersion } from "@/lib/netzero/dispersion";
import { formatYears } from "@/lib/netzero/format";

export function SectorContextSection({
  dispersion,
  tbrIqrThreshold,
  scoreIqrThreshold,
}: {
  dispersion: SectorDispersion;
  tbrIqrThreshold: number;
  scoreIqrThreshold: number;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Sector context</h3>
      <p className="text-sm">
        <span className={dispersion.tradeable ? "font-semibold text-primary" : "font-semibold text-muted-foreground"}>
          {dispersion.tradeable ? "Tradeable" : "Flat"}
        </span>{" "}
        · {dispersion.sector} · {dispersion.n} companies
      </p>
      <p className="text-xs text-muted-foreground">
        TBR IQR {formatYears(dispersion.tbrIqr)} (threshold {formatYears(tbrIqrThreshold)}) · score IQR{" "}
        {dispersion.scoreIqr.toFixed(1)} (threshold {scoreIqrThreshold})
      </p>
    </section>
  );
}
