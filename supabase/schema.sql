-- Record of every schema change run in the Supabase SQL Editor.
-- Append new SQL at the bottom, newest last, with a short comment.
-- Every table needs RLS enabled and at least one policy.

-- Example (not yet applied):
--
-- create table public.todos (
--   id bigint generated always as identity primary key,
--   user_id uuid not null default auth.uid() references auth.users (id),
--   task text not null,
--   created_at timestamptz not null default now()
-- );
--
-- alter table public.todos enable row level security;
--
-- create policy "own rows" on public.todos
--   for all to authenticated
--   using ((select auth.uid()) = user_id)
--   with check ((select auth.uid()) = user_id);

-- sp500_esg_zscores: sector-relative z-scores (financial/social/environmental
-- variables) for every S&P 500 constituent. Public reference data, not
-- per-user -- loaded via service role, read-only for regular clients.
create table public.sp500_esg_zscores (
  ticker text primary key,
  company_name text not null,
  sector text not null,
  sub_industry text not null,
  asset_turnover_zscore double precision,
  profit_to_revenue_zscore double precision,
  fcf_to_revenue_zscore double precision,
  net_debt_to_ebitda_zscore double precision,
  full_time_employees_zscore double precision,
  total_esg_risk_score_zscore double precision,
  controversy_score_ordinal_zscore double precision,
  scope1_2_total_tco2e_zscore double precision,
  emissions_intensity_per_revenue_zscore double precision,
  revenue_q_zscore double precision,
  net_income_q_zscore double precision,
  ebitda_q_zscore double precision,
  total_assets_q_zscore double precision,
  net_debt_q_zscore double precision,
  free_cash_flow_q_zscore double precision,
  scope1_tco2e_zscore double precision,
  scope2_tco2e_zscore double precision,
  renewable_fuel_pct_zscore double precision,
  updated_at timestamptz not null default now()
);

alter table public.sp500_esg_zscores enable row level security;

create policy "public read access" on public.sp500_esg_zscores
  for select to authenticated, anon
  using (true);
