import { TickerLink } from "@/components/netzero/portfolio/ticker-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AllocationRow } from "@/lib/netzero/allocation";
import { formatPercent, formatUsd } from "@/lib/netzero/format";

export function PositionTable({
  rows,
  highlight,
  showActive,
  showReason,
}: {
  rows: AllocationRow[];
  highlight: string | null;
  showActive: boolean;
  showReason: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No positions.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Position</TableHead>
            <TableHead className="text-right">Weight</TableHead>
            {showActive && <TableHead className="text-right">Active</TableHead>}
            <TableHead className="text-right">Dollars</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Score</TableHead>
            {showReason && <TableHead>Reason</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.ticker} id={`row-${r.ticker}`} className={r.ticker === highlight ? "bg-accent" : undefined}>
              <TableCell>
                <TickerLink ticker={r.ticker} />
              </TableCell>
              <TableCell>{r.companyName}</TableCell>
              <TableCell>{r.sector}</TableCell>
              <TableCell className="capitalize">{r.position}</TableCell>
              <TableCell className="text-right tabular-nums">{formatPercent(r.weight, 2)}</TableCell>
              {showActive && (
                <TableCell className="text-right tabular-nums">
                  {r.activeWeight === null ? "n/a" : `${(r.activeWeight * 100).toFixed(2)}pp`}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">{formatUsd(r.dollars)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.shares === null ? "n/a" : r.shares.toLocaleString("en-US")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.score === null ? "n/a" : r.score.toFixed(1)}</TableCell>
              {showReason && <TableCell className="min-w-[24rem] text-xs">{r.reason}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
