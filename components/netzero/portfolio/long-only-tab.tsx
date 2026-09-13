import { Bar } from "@/components/netzero/bar";
import { PositionTable } from "@/components/netzero/portfolio/position-table";
import { SummaryGrid } from "@/components/netzero/portfolio/summary-grid";
import { formatPercent } from "@/lib/netzero/format";
import type { PortfolioView } from "@/lib/netzero/portfolio";

export function LongOnlyTab({ view, highlight }: { view: PortfolioView; highlight: string | null }) {
  const held = view.longOnlyRows.filter((r) => r.weight > 1e-12).length;
  const tilted = view.sectorTable.filter((s) => s.tradeable).length;
  const maxWeight = Math.max(0, ...view.sectorTable.flatMap((s) => [s.benchmark, s.tilt, s.exclusion]));

  return (
    <div className="flex flex-col gap-8">
      <SummaryGrid
        items={[
          ["Names held", String(held)],
          ["Active share", formatPercent(view.summary.activeShare, 1)],
          ["Tilted sectors", `${tilted} of ${view.sectorTable.length}`],
          ["Excluded by naive screen", String(view.result.exclusion.excluded.length)],
        ]}
      />
      <p className="text-xs text-muted-foreground">
        Starts from S&amp;P 500 float-adjusted cap weights and tilts within each tradeable sector toward high scenario
        scores. Sector weights stay at benchmark; active weight is limited to ±2pp per name and no name above 5% (PDF
        §9.2).
      </p>
      {view.longOnly.events.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary>{view.longOnly.events.length} limit events</summary>
          <ul className="list-disc pl-5">
            {view.longOnly.events.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Sector weights: benchmark vs tilt vs exclusion</h3>
        <p className="text-xs text-muted-foreground">
          Excluding the highest-emitting decile changes sector weights, so it is a sector bet in disguise and it removes
          exactly the companies where within-sector selection pays. The tilt keeps every sector at benchmark.
        </p>
        {view.sectorTable.map((s) => (
          <div key={s.sector} className="flex flex-col gap-1 border-b py-2">
            <p className="text-sm font-medium">
              {s.sector}
              {s.tradeable ? "" : " (flat)"}
            </p>
            <Bar label="Benchmark" value={s.benchmark} max={maxWeight} text={formatPercent(s.benchmark, 1)} />
            <Bar label="Tilt" value={s.tilt} max={maxWeight} text={formatPercent(s.tilt, 1)} />
            <Bar label="Exclusion" value={s.exclusion} max={maxWeight} text={formatPercent(s.exclusion, 1)} />
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Largest overweights</h3>
        <PositionTable rows={view.topOverweights} highlight={highlight} showActive showReason />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Largest underweights</h3>
        <PositionTable rows={view.topUnderweights} highlight={highlight} showActive showReason />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Full weight vector ({view.longOnlyRows.length} names)</h3>
        <PositionTable rows={view.longOnlyRows} highlight={highlight} showActive showReason={false} />
      </section>
    </div>
  );
}
