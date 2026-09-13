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
