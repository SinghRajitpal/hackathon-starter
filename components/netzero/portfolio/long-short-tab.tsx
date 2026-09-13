import { PositionTable } from "@/components/netzero/portfolio/position-table";
import { SummaryGrid } from "@/components/netzero/portfolio/summary-grid";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPercent } from "@/lib/netzero/format";
import type { PortfolioView } from "@/lib/netzero/portfolio";
import { groupBySector } from "@/lib/netzero/scenario";

export function LongShortTab({ view, highlight }: { view: PortfolioView; highlight: string | null }) {
  const book = view.longShort;
  const legs = [...groupBySector(book.positions)].map(([sector, positions]) => ({
    sector,
    gross: book.sectorGross.get(sector) ?? 0,
    longs: positions.filter((p) => p.side === "long").map((p) => p.ticker),
    shorts: positions.filter((p) => p.side === "short").map((p) => p.ticker),
  }));

  return (
    <div className="flex flex-col gap-8">
      <SummaryGrid
        items={[
          ["Gross", formatPercent(book.gross, 1)],
          ["Net", formatPercent(book.net, 1)],
          ["Cash", formatPercent(book.cash, 1)],
          ["Names", String(book.positions.length)],
        ]}
      />
      <p className="text-xs text-muted-foreground">
        In every tradeable sector: long the highest scenario scores, short the lowest, top and bottom quintile with
        two to five names per side, equal dollars per leg, sized by distance from the sector median. Sector gross
        follows score dispersion. Limits: no name above 3% of gross, no sector above 20% of gross, gross 200% of
        capital, net zero. Borrow availability and cost are not modelled; every name is treated as shortable (PDF
        §9.1).
      </p>
      {book.events.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {book.events.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Sector legs</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead>Longs</TableHead>
                <TableHead>Shorts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legs.map((leg) => (
                <TableRow key={leg.sector}>
                  <TableCell className="font-medium">{leg.sector}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(leg.gross, 1)}</TableCell>
                  <TableCell className="font-mono text-xs">{leg.longs.join(", ")}</TableCell>
                  <TableCell className="font-mono text-xs">{leg.shorts.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Largest longs</h3>
        <PositionTable rows={view.largestLongs} highlight={highlight} showActive={false} showReason />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Largest shorts</h3>
        <PositionTable rows={view.largestShorts} highlight={highlight} showActive={false} showReason />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">All positions ({view.longShortRows.length})</h3>
        <PositionTable rows={view.longShortRows} highlight={highlight} showActive={false} showReason={false} />
      </section>
    </div>
  );
}
