import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CompanyDetail, type CompanyDetailRow } from "@/components/company-detail";

const DETAIL_COLUMNS =
  "ticker, company_name, sector, score, rank, sector_rank, weight_env_intensity, weight_esg_risk, weight_controversy, weight_asset_turnover, weight_profit_margin, weight_fcf_margin, weight_leverage, contrib_env_intensity, contrib_esg_risk, contrib_controversy, contrib_asset_turnover, contrib_profit_margin, contrib_fcf_margin, contrib_leverage";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select(DETAIL_COLUMNS)
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (error) console.error(error);
  if (!data) notFound();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">
        {data.company_name} <span className="text-muted-foreground font-mono text-xl">{data.ticker}</span>
      </h1>
      <CompanyDetail row={data as CompanyDetailRow} />
    </main>
  );
}
