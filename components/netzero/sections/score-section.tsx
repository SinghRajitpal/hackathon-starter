import { Bar } from "@/components/netzero/bar";
import { formatPercent } from "@/lib/netzero/format";
import type { CompanyScore, SectorModel } from "@/lib/netzero/scenario";
import { VARIABLE_LABEL } from "@/lib/netzero/types";

export function ScoreSection({ score, model }: { score: CompanyScore; model: SectorModel }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Net-zero scenario score</h3>
      <p className="text-2xl font-bold tabular-nums">
        {score.score.toFixed(1)}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          rank {score.rank}/{score.sectorSize} in {score.sector} · top {score.topPercent}%
        </span>
      </p>
      <p className="text-xs text-muted-foreground">What drives the score (share of distance from the sector ideal)</p>
      <div className="flex flex-col gap-1">
        {model.variables.map((v) => (
          <Bar key={v} label={VARIABLE_LABEL[v]} value={score.shares[v]} text={formatPercent(score.shares[v])} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Sector weights: {model.variables.map((v, j) => `${VARIABLE_LABEL[v]} ${formatPercent(model.weights[j])}`).join(" · ")}
      </p>
      {model.weightEvents.length > 0 && (
        <p className="text-xs text-muted-foreground">Weight cap: {model.weightEvents.join("; ")}</p>
      )}
    </section>
  );
}
