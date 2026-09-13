import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatYears } from "@/lib/netzero/format";
import type { PortfolioView } from "@/lib/netzero/portfolio";

export function SectorsTab({ view }: { view: PortfolioView }) {
  const { dispersion } = view.result;
  const { tbrIqrThreshold, scoreIqrThreshold } = view.config;
  const tradeable = dispersion.filter((d) => d.tradeable).length;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Where the trade is (PDF §8): sectors ordered by the dispersion of the scenario score. A sector is tradeable if
        its TBR interquartile range exceeds {formatYears(tbrIqrThreshold)} or its score interquartile range exceeds{" "}
        {scoreIqrThreshold} points. Flat sectors get no pair trades and stay at benchmark in the long-only tilt.{" "}
        {tradeable} of {dispersion.length} sectors are tradeable.
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sector</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Companies</TableHead>
              <TableHead className="text-right">TBR IQR</TableHead>
              <TableHead className="text-right">Score IQR</TableHead>
              <TableHead className="text-right">Median TBR</TableHead>
              <TableHead className="text-right">Median score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispersion.map((d) => (
              <TableRow key={d.sector}>
                <TableCell className="font-medium">{d.sector}</TableCell>
                <TableCell className={d.tradeable ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {d.tradeable ? "Tradeable" : "Flat"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.n}</TableCell>
                <TableCell className="text-right tabular-nums">{formatYears(d.tbrIqr)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.scoreIqr.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatYears(d.medianTbr)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.medianScore.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
