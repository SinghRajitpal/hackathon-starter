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

-- sp500_esg_raw: the actual values behind sp500_esg_zscores (revenue,
-- employee counts, emissions in tonnes, etc.), not standardized scores.
-- Same exclusion as the z-scores table: independent raw financial inputs
-- (revenue, assets, EBITDA, etc. on their own) are dropped, keeping only the
-- four ratios -- they aren't comparable across differently-sized companies
-- the way a ratio is, so there's no reason to carry them into either table.
create table public.sp500_esg_raw (
  ticker text primary key,
  company_name text not null,
  sector text not null,
  sub_industry text not null,
  quarter_end date,
  asset_turnover double precision,
  profit_to_revenue double precision,
  fcf_to_revenue double precision,
  net_debt_to_ebitda double precision,
  full_time_employees double precision,
  controversy_level text,
  total_esg_risk_score double precision,
  controversy_score_ordinal double precision,
  wikirate_matched boolean,
  scope1_source text,
  scope1_year integer,
  scope1_tco2e double precision,
  scope2_year integer,
  scope2_tco2e double precision,
  scope1_2_total_tco2e double precision,
  renewable_fuel_pct double precision,
  renewable_fuel_pct_year integer,
  emissions_intensity_per_revenue double precision,
  updated_at timestamptz not null default now()
);

alter table public.sp500_esg_raw enable row level security;

create policy "public read access" on public.sp500_esg_raw
  for select to authenticated, anon
  using (true);

-- Gemini API key stored in Vault (see also: `select vault.create_secret(...)`,
-- run once outside this file since it contains the actual key value).
-- get_gemini_api_key() is the only way to read it back out -- granted to
-- service_role only, so it's callable from trusted server-side code (a
-- Next.js server action/route using the service role key, or another
-- Postgres function) but never from the browser via the anon/authenticated
-- roles PostgREST normally exposes RPCs to.
create function public.get_gemini_api_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'gemini_api_key';
$$;

revoke execute on function public.get_gemini_api_key() from public, anon, authenticated;
grant execute on function public.get_gemini_api_key() to service_role;

-- ===========================================================================
-- Tool 1 (Sustainability Evaluator), copied from branch gemini-integration.
-- Documentation only: these tables already exist in the shared project.
-- ===========================================================================

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

-- ===========================================================================
-- Tool 2 (Net-Zero Scorer), copied from branch nz/explain-gemini.
-- Documentation only: these tables already exist in the shared project.
-- ===========================================================================

begin;

-- nz_*: Part 2 net-zero scenario inputs (docs/superpowers/specs/2026-09-13-net-zero-scenario-design.md §5).
-- Public reference data, loaded via the session pooler by data/pipeline/nz/19_load_supabase.py,
-- read-only for regular clients.
create table public.nz_company_inputs (
  ticker text primary key,
  company_name text not null,
  sector text not null,
  sub_industry text not null,
  e_scope2 double precision,
  e_combustion double precision,
  e_fleet double precision,
  e_process double precision,
  e_fugitive double precision,
  emissions_year integer,
  revenue_ttm double precision,
  ebitda_ttm double precision,
  fcf_ttm double precision,
  net_debt double precision,
  de double precision,
  ben double precision,
  de_ben_status text not null default 'unclassified'
    check (de_ben_status in ('tagged', 'note', 'imputed', 'unclassified')),
  fossil_generation_share double precision,
  renewable_generation_share double precision,
  price double precision,
  shares_outstanding double precision,
  float_cap double precision,
  flags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.nz_emissions_sources (
  ticker text not null references public.nz_company_inputs (ticker) on delete cascade,
  source text not null,
  category text not null check (category in ('scope2', 'combustion', 'fleet', 'process', 'fugitive')),
  tco2e double precision not null,
  year integer,
  reference text,
  primary key (ticker, source, category)
);

create table public.nz_segments (
  ticker text not null references public.nz_company_inputs (ticker) on delete cascade,
  segment text not null,
  revenue double precision,
  share double precision,
  class text not null check (class in ('exposed', 'beneficiary', 'neutral', 'electricity_generation')),
  fiscal_year integer,
  filing_url text,
  method text not null check (method in ('xbrl', 'note')),
  primary key (ticker, segment)
);

create table public.nz_mac_costs (
  category text primary key check (category in ('scope2', 'combustion', 'fleet', 'process', 'fugitive')),
  low double precision not null,
  mid double precision not null,
  high double precision not null,
  source text not null,
  source_date date not null
);

create table public.nz_product_map (
  list text not null check (list in ('exposed', 'beneficiary')),
  product_line text not null,
  source text not null,
  primary key (list, product_line)
);

create table public.nz_validation_2019 (
  ticker text primary key,
  sector text not null,
  tbr_2019 double precision,
  intensity_2019 double precision,
  intensity_latest double precision,
  intensity_change double precision
);

alter table public.nz_company_inputs enable row level security;
alter table public.nz_emissions_sources enable row level security;
alter table public.nz_segments enable row level security;
alter table public.nz_mac_costs enable row level security;
alter table public.nz_product_map enable row level security;
alter table public.nz_validation_2019 enable row level security;

create policy "public read access" on public.nz_company_inputs for select to authenticated, anon using (true);
create policy "public read access" on public.nz_emissions_sources for select to authenticated, anon using (true);
create policy "public read access" on public.nz_segments for select to authenticated, anon using (true);
create policy "public read access" on public.nz_mac_costs for select to authenticated, anon using (true);
create policy "public read access" on public.nz_product_map for select to authenticated, anon using (true);
create policy "public read access" on public.nz_validation_2019 for select to authenticated, anon using (true);

commit;

-- ---------------------------------------------------------------------------
-- nz explanation layer: Gemini key accessor and explanation cache (13 Sep 2026).
-- The key itself lives only in Vault (secret name gemini_api_key); set or rotate it with
--   select vault.update_secret((select id from vault.secrets where name = 'gemini_api_key'), '<key>');
-- ---------------------------------------------------------------------------

create or replace function public.get_secret(secret_name text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
    and secret_name in ('gemini_api_key')
  limit 1;
$$;
revoke all on function public.get_secret(text) from public, anon, authenticated;
grant execute on function public.get_secret(text) to service_role;

-- One row per (scope, key, packet hash): a changed engine value changes the hash and misses the cache.
create table if not exists public.nz_explanations (
  scope text not null check (scope in ('company', 'sector', 'market', 'portfolio')),
  key text not null,
  input_hash text not null,
  payload jsonb not null,
  model text not null,
  created_at timestamptz not null default now(),
  primary key (scope, key, input_hash)
);
-- RLS on with no anon/authenticated policy: only the server (service role) reads and writes.
alter table public.nz_explanations enable row level security;
revoke all on table public.nz_explanations from anon, authenticated;
grant select, insert, update on table public.nz_explanations to service_role;
