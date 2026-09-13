import { Bar } from "@/components/netzero/bar";
import { formatUsd, formatYears } from "@/lib/netzero/format";
import type { CompanyScore } from "@/lib/netzero/scenario";
import { CATEGORIES, CATEGORY_LABEL, type CompanyInput, type MacVector } from "@/lib/netzero/types";

export function BurdenSection({
  company,
  score,
  sectorMedianTbr,
  mac,
}: {
  company: CompanyInput;
  score: CompanyScore;
  sectorMedianTbr: number;
  mac: MacVector;
}) {
  const parts = CATEGORIES.map((category) => {
    const emissions = company.emissions[category];
    return { category, cost: emissions === null ? null : emissions * Math.max(mac[category], 0) };
  });
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Transition burden</h3>
      <p className="text-sm">
        TBR <span className="font-semibold">{formatYears(score.tbr)}</span> of EBITDA (sector median{" "}
        {formatYears(sectorMedianTbr)}) · bill {formatUsd(score.bill)}
      </p>
      <div className="flex flex-col gap-1">
        {parts.map(({ category, cost }) => (
          <Bar
            key={category}
            label={CATEGORY_LABEL[category]}
            value={cost ?? 0}
            max={score.bill ?? 0}
            text={cost === null ? "n/a" : formatUsd(cost)}
          />
        ))}
      </div>
    </section>
  );
}
