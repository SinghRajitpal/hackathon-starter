import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CompanyDetail, type CompanyDetailRow } from "@/components/company-detail";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  const supabase = await createClient();
  // select("*"): every column in this table is intended to be
  // user-facing (no imputed-flag or other internal column exists here
  // by design -- see score_engine.py's Global Constraints notes).
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select("*")
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
