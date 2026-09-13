import { reasonSentence, type PositionLabel } from "@/lib/netzero/explain";
import { formatPercent } from "@/lib/netzero/format";
import type { LongOnlyBook } from "@/lib/netzero/longOnly";
import type { LongShortBook } from "@/lib/netzero/longShort";
import type { CompanyScore } from "@/lib/netzero/scenario";

export function PositionSection({
  ticker,
  score,
  sectorMedianTbr,
  longShort,
  longOnly,
}: {
  ticker: string;
  score: CompanyScore;
  sectorMedianTbr: number;
  longShort: LongShortBook;
  longOnly: LongOnlyBook;
}) {
  const ls = longShort.positions.find((p) => p.ticker === ticker);
  const lo = longOnly.weights.get(ticker);
  const activePp = lo ? lo.active * 100 : 0;
  const longOnlyText = !lo
    ? "not in the benchmark"
    : activePp > 1e-7
      ? `OVERWEIGHT +${activePp.toFixed(2)}pp`
      : activePp < -1e-7
        ? `UNDERWEIGHT ${activePp.toFixed(2)}pp`
        : "held at benchmark";
  const position: PositionLabel = ls
    ? ls.side
    : activePp > 1e-7
      ? "overweight"
      : activePp < -1e-7
        ? "underweight"
        : "untraded";

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">Position</h3>
      <p className="text-sm">
        Long-only tilt: {longOnlyText}
        {lo ? ` (benchmark ${formatPercent(lo.benchmark, 2)})` : ""}
      </p>
      <p className="text-sm">
        Long/short book: {ls ? `${ls.side.toUpperCase()} ${formatPercent(ls.weight, 2)} of capital` : "not traded"}
      </p>
      <p className="text-sm italic">{reasonSentence(score, position, sectorMedianTbr)}</p>
    </section>
  );
}
