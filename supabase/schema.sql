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
