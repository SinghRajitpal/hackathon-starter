import { formatPercent } from "@/lib/netzero/format";
import type { LongShortBook } from "@/lib/netzero/longShort";

export function PositionSection({ ticker, longShort }: { ticker: string; longShort: LongShortBook }) {
  const position = longShort.positions.find((p) => p.ticker === ticker);
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Position</h3>
      <p className="text-sm">
        Long/short book:{" "}
        {position ? `${position.side.toUpperCase()} ${formatPercent(position.weight, 2)} of capital` : "not traded"}
      </p>
    </section>
  );
}
