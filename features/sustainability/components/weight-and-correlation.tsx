import { AXES } from "@/features/sustainability/variables";
import { pillarShares } from "@/features/sustainability/components/leaderboard-table";
import type { CorrelationRow, ScoreRow } from "@/features/sustainability/types";

type WeightRow = Pick<ScoreRow,
  | "weight_env_intensity"
  | "weight_esg_risk"
  | "weight_controversy"
  | "weight_asset_turnover"
  | "weight_profit_margin"
  | "weight_fcf_margin"
  | "weight_leverage"
>;

export function WeightVector({ weights }: { weights: WeightRow }) {
  const { environmental, social, financial } = pillarShares(weights);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-muted-foreground">
        Weight vector (manually adjusted from the entropy baseline -- Financial pillar capped at 53%, cut entirely from asset turnover; same for every company)
      </div>
      <div className="flex flex-col gap-1">
        {AXES.map((axis) => {
          const w = weights[`weight_${axis.key}`];
          return (
            <div key={axis.key} className="flex items-center gap-2 text-xs">
              <span className="w-36 shrink-0 text-muted-foreground">{axis.label}</span>
              <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${(w * 100).toFixed(1)}%` }} />
              </div>
              <span className="w-10 text-right">{(w * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground">
        Pillar shares: Environmental {(environmental * 100).toFixed(0)}%, Social{" "}
        {(social * 100).toFixed(0)}%, Financial/Operational {(financial * 100).toFixed(0)}%
      </div>
    </div>
  );
}

export function CorrelationMatrix({ rows }: { rows: CorrelationRow[] }) {
  const labelByKey = Object.fromEntries(AXES.map((a) => [a.key, a.label]));
  const byPair = new Map(rows.map((r) => [`${r.variable_a}|${r.variable_b}`, r.r]));
  const keys = AXES.map((a) => a.key);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs font-semibold text-muted-foreground">
        Correlation matrix (gate for pruning the variable set -- max |r| well under the 0.8 threshold)
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-1"></th>
              {keys.map((k) => (
                <th key={k} className="p-1 text-muted-foreground font-normal">{labelByKey[k].split(" ")[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((rowKey) => (
              <tr key={rowKey}>
                <td className="p-1 text-muted-foreground whitespace-nowrap">{labelByKey[rowKey]}</td>
                {keys.map((colKey) => {
                  const r = byPair.get(`${rowKey}|${colKey}`) ?? 0;
                  const isDiagonal = rowKey === colKey;
                  const magnitude = Math.min(Math.abs(r), 1);
                  return (
                    <td
                      key={colKey}
                      className="p-1 text-center font-mono"
                      style={{
                        backgroundColor: isDiagonal
                          ? "transparent"
                          : `color-mix(in srgb, var(--primary) ${(magnitude * 40).toFixed(0)}%, transparent)`,
                      }}
                    >
                      {r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
