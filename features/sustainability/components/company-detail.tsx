import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyDetailRow } from "@/features/sustainability/types";
import { AXES } from "@/features/sustainability/variables";

function generateExplanation(row: CompanyDetailRow): string {
  const sorted = [...AXES].sort(
    (a, b) => row[`contrib_${b.key}`] - row[`contrib_${a.key}`],
  );
  const costliest = sorted.slice(0, 2).map((a) => a.label);
  const closest = sorted[sorted.length - 1].label;
  return `${row.company_name}'s distance from the ideal is driven mostly by ${costliest.join(" and ")}. It sits closest to the frontier on ${closest}.`;
}

export function CompanyDetail({ row }: { row: CompanyDetailRow }) {
  const environmental = row.weight_env_intensity;
  const social = row.weight_esg_risk + row.weight_controversy;
  const financial =
    row.weight_asset_turnover + row.weight_profit_margin + row.weight_fcf_margin + row.weight_leverage;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{row.score.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              Rank {row.rank} overall / {row.sector_rank} in {row.sector}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{generateExplanation(row)}</p>

          <div className="text-xs text-muted-foreground">
            {row.percentile_index.toFixed(0)}th percentile of the index, {row.percentile_sector.toFixed(0)}th percentile of {row.sector}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Environmental</div>
              <div className="text-lg font-semibold">{row.pillar_environmental_score.toFixed(0)}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Social</div>
              <div className="text-lg font-semibold">{row.pillar_social_score.toFixed(0)}</div>
            </div>
            <div className="rounded border p-2">
              <div className="text-xs text-muted-foreground">Financial/Operational</div>
              <div className="text-lg font-semibold">{row.pillar_financial_score.toFixed(0)}</div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              Distance-to-ideal decomposition
            </div>
            <div className="flex flex-col gap-1">
              {AXES.map((axis) => {
                const contrib = row[`contrib_${axis.key}`];
                return (
                  <div key={axis.key} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-muted-foreground">{axis.label}</span>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(contrib * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right">{(contrib * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Pillar weight shares: Environmental {(environmental * 100).toFixed(0)}%, Social{" "}
            {(social * 100).toFixed(0)}%, Financial/Operational {(financial * 100).toFixed(0)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
