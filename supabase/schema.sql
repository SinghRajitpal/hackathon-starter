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

-- sp500_esg_zscores: drop the independent raw-financial-input z-scores,
-- keeping only the ratio z-scores (asset_turnover, profit_to_revenue,
-- fcf_to_revenue, net_debt_to_ebitda) -- the underlying values on their own
-- (revenue, assets, etc.) aren't comparable across companies of different
-- sizes the way a ratio is.
alter table public.sp500_esg_zscores drop column if exists revenue_q_zscore;
alter table public.sp500_esg_zscores drop column if exists net_income_q_zscore;
alter table public.sp500_esg_zscores drop column if exists ebitda_q_zscore;
alter table public.sp500_esg_zscores drop column if exists total_assets_q_zscore;
alter table public.sp500_esg_zscores drop column if exists net_debt_q_zscore;
alter table public.sp500_esg_zscores drop column if exists free_cash_flow_q_zscore;

-- sp500_esg_zscores: data fix, not a schema change -- the original load
-- (via psycopg2 execute_values) wrote pandas NaN as the literal float 'NaN'
-- instead of SQL NULL for every missing value, because numpy silently
-- coerces None back to NaN when assigned into a float64 column. This made
-- every double precision column look 100% populated (count() doesn't
-- exclude NaN, only NULL). Converts them to real NULLs; see 07_load_supabase.py
-- for the corrected loading code.
do $$
declare col text;
begin
  for col in
    select column_name from information_schema.columns
    where table_name = 'sp500_esg_zscores' and table_schema = 'public' and data_type = 'double precision'
  loop
    execute format('update public.sp500_esg_zscores set %I = NULL where %I = ''NaN''', col, col);
  end loop;
end $$;

-- sp500_esg_scores: entropy-weighted TOPSIS sustainability score (0-100)
-- and rank for every S&P 500 constituent, computed by
-- data/pipeline/09_score.py per sustainability-evaluator-blueprint-v1.4.
-- Public reference data, not per-user -- loaded via service role,
-- read-only for regular clients. Every company is scored and ranked;
-- none are excluded for missing data (imputed silently with a sector
-- median and a small disclosure penalty -- see score_engine.py). No
-- column here indicates which values were imputed, by design.
create table public.sp500_esg_scores (
  ticker text primary key,
  company_name text not null,
  sector text not null,
  sub_industry text not null,
  score double precision not null,
  rank integer not null,
  sector_rank integer not null,
  d_plus double precision not null,
  d_minus double precision not null,
  weight_env_intensity double precision not null,
  weight_esg_risk double precision not null,
  weight_controversy double precision not null,
  weight_asset_turnover double precision not null,
  weight_profit_margin double precision not null,
  weight_fcf_margin double precision not null,
  weight_leverage double precision not null,
  contrib_env_intensity double precision not null,
  contrib_esg_risk double precision not null,
  contrib_controversy double precision not null,
  contrib_asset_turnover double precision not null,
  contrib_profit_margin double precision not null,
  contrib_fcf_margin double precision not null,
  contrib_leverage double precision not null,
  env_intensity_raw double precision,
  esg_risk_raw double precision,
  controversy_raw double precision,
  asset_turnover_raw double precision,
  profit_margin_raw double precision,
  fcf_margin_raw double precision,
  leverage_raw double precision,
  updated_at timestamptz not null default now()
);

alter table public.sp500_esg_scores enable row level security;

create policy "public read access" on public.sp500_esg_scores
  for select to authenticated, anon
  using (true);

-- sp500_esg_scores: section 10 output-layer additions -- per-company
-- pillar sub-scores (no formula given in the blueprint; see
-- score_engine.pillar_scores's docstring for the construction used) and
-- percentile within the index and within the sector.
alter table public.sp500_esg_scores add column if not exists pillar_environmental_score double precision;
alter table public.sp500_esg_scores add column if not exists pillar_social_score double precision;
alter table public.sp500_esg_scores add column if not exists pillar_financial_score double precision;
alter table public.sp500_esg_scores add column if not exists percentile_index double precision;
alter table public.sp500_esg_scores add column if not exists percentile_sector double precision;

-- sp500_esg_correlation: the 7x7 correlation matrix (blueprint section
-- 4's gate, computed once against the real normalised+penalised
-- matrix) used to confirm the variable set needed no pruning -- shown
-- on the leaderboard per section 10. One row per variable pair.
create table public.sp500_esg_correlation (
  variable_a text not null,
  variable_b text not null,
  r double precision not null,
  primary key (variable_a, variable_b)
);

alter table public.sp500_esg_correlation enable row level security;

create policy "public read access" on public.sp500_esg_correlation
  for select to authenticated, anon
  using (true);

-- sp500_esg_gemini_analysis: cached Gemini AI-narration layer on top of
-- the quantitative model (app/api/sustainability-analysis/route.ts).
-- Gemini is an explanation layer, never a second scoring model -- this
-- table only stores generated prose, keyed by ticker, plus the score
-- and rank that were in effect when it was generated so the API route
-- can detect staleness (the underlying model data changed) and
-- regenerate. Unlike every other table in this schema, anon can INSERT/
-- UPDATE here too -- the app's Supabase client (lib/supabase/server.ts,
-- anon-key-based, no service role) is what writes the cache after each
-- Gemini call. Narrower privilege escalation is acceptable here since
-- the only content ever written is Gemini's own generated JSON for a
-- ticker that already exists in sp500_esg_scores.
create table public.sp500_esg_gemini_analysis (
  ticker text primary key,
  score double precision not null,
  rank integer not null,
  analysis jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.sp500_esg_gemini_analysis enable row level security;

create policy "public read access" on public.sp500_esg_gemini_analysis
  for select to authenticated, anon
  using (true);

create policy "public write access for caching" on public.sp500_esg_gemini_analysis
  for insert to authenticated, anon
  with check (true);

create policy "public update access for caching" on public.sp500_esg_gemini_analysis
  for update to authenticated, anon
  using (true) with check (true);
