# S&P 500 financials / social / environmental dataset

`out/sp500_esg_financials_zscores.csv` is the deliverable: one row per
current S&P 500 constituent, with identifiers plus a sector-relative
z-score column for each variable (z = (value - sector mean) / sector std,
grouped by GICS sector -- comparing a bank's leverage ratio to a tech
company's isn't meaningful otherwise). This file ships z-scores only --
no raw values -- by design.

Built by the scripts in `pipeline/`, run in order (`01_` through `08_`, then
`06_` again to rescore -- see below). Requires Python 3.11+; install deps
with `pip install -r pipeline/requirements.txt`. Intermediate per-source
CSVs (universe/financials/social/environmental) are not kept in this repo,
except `sp500_esg_financials_raw.csv`, which is kept alongside the z-scores
file since it has the actual values, not just standardized scores.

Also loaded into Supabase: `public.sp500_esg_zscores` (see
`supabase/schema.sql`), via `07_load_supabase.py` (direct Postgres
connection -- Supabase's REST API can't run DDL, and its "Direct connection"
host is IPv6-only, so use the **session pooler** connection string).

## Credentials needed to re-run the pipeline

- **Kaggle** (`03_fetch_social.py`, controversy/reputation column only): create
  a free account, Account > Create New API Token, save the downloaded
  `kaggle.json` to `~/.kaggle/kaggle.json`.
- **Wikirate** (`04_fetch_environmental.py`): create a free account at
  wikirate.org, generate an API key from your profile's Accounts tab, and set
  it as the `WIKIRATE_API_KEY` environment variable before running the script.
  Wikirate rate-limits aggressively (~58 rapid requests before a 429); the
  script paces requests to stay under that.
- **EPA GHGRP** (`08_fetch_epa_scope1.py`): no credentials, but the raw files
  aren't fetched automatically (they're large static annual releases, not an
  API) -- download `ghgp_data_2023.xlsx` and `ghgp_data_parent_company.xlsb`
  from https://www.epa.gov/ghgreporting/data-sets into `data/raw/epa/`.

Both API-based scripts degrade gracefully (leave the relevant columns null)
if credentials aren't present, so the pipeline can still run end-to-end
without them.

## Variables

**Identifiers**: `ticker`, `company_name`, `sector`, `sub_industry`

**Everything else is a `<variable>_zscore` column**, computed within each
row's GICS sector (z = (value - sector mean) / sector std). Null if the
underlying value was null, or if the sector had fewer than 3 non-null values
for that variable. The underlying variables, by source:

- **Financials & Operating** (most recently reported quarter, single quarter
  not trailing-twelve-months, source: yfinance live at run time):
  `revenue_q`, `net_income_q`, `ebitda_q`, `total_assets_q`, `net_debt_q`,
  `free_cash_flow_q`, and the four ratios derived from them --
  `asset_turnover`, `profit_to_revenue`, `fcf_to_revenue`, `net_debt_to_ebitda`.
- **Social**: `full_time_employees` (yfinance, live) and
  `total_esg_risk_score` / `controversy_score_ordinal` (Kaggle "S&P 500 ESG
  Risk Ratings" dataset, Sustainalytics-sourced -- Yahoo's own live ESG
  endpoint was discontinued, so this one is a snapshot as of that Kaggle
  dataset's last update, not live; controversy is mapped from its original
  text categories to a 0-5 ordinal scale before scoring).
- **Environmental**: `scope1_tco2e` is blended -- preferred source is EPA's
  GHGRP (`08_fetch_epa_scope1.py`; US facilities are legally required to
  report direct emissions there if >25,000 tons CO2e/yr, most recent
  published year 2023, matched to tickers by normalizing free-text parent
  company names since EPA's data has no ticker/CIK field), falling back to
  Wikirate/GRI where EPA has no match. `scope2_tco2e` is Wikirate/GRI only --
  the EPA program doesn't collect Scope 2 (purchased electricity) at all, so
  there's no equivalent authoritative source for it. `scope1_2_total_tco2e`
  and `emissions_intensity_per_revenue` (scope1+2 / annualized quarterly
  revenue -- approximate, different periods) both require both scopes, so
  their coverage is bounded by Scope 2's (the weaker link). `renewable_fuel_pct`
  is disabled in the current run (see Known gaps, all-null).
  `scope1_source` records which source won per row (`EPA GHGRP` /
  `Wikirate/GRI`) in the raw CSV but isn't itself scored or shipped to
  Supabase.

A YoY emissions trend variable was originally built but removed at the
user's request in favor of latest-value-only data.

## Known gaps

- **Asset turnover and Net Debt/EBITDA are not meaningful for banks, insurers,
  and REITs** (~70+ tickers) -- their balance sheets don't work like a normal
  operating company's. Sector-relative z-scoring mitigates but doesn't fully
  fix this.
- **Single-quarter flow figures (revenue, net income, FCF) can be noisy** for
  seasonal businesses or one-off items (e.g. large one-time gains/losses),
  since these are not trailing-twelve-month smoothed.
- **Environmental coverage is partial, even after blending EPA + Wikirate.**
  Scope 1 alone: ~36% (181/503) have a value now (up from ~25% Wikirate-only).
  Combined Scope 1+2: ~24% (120/503) -- bounded by Scope 2, which has no
  authoritative/mandatory source anywhere, for any company, since it's a
  calculated value (based on purchased electricity) rather than a directly
  monitored one. There is no free source that gets meaningfully past this
  for Scope 2. Renewable-fuel data was dropped from this run to cut API call
  volume; the field exists in the code (`FETCH_RENEWABLE = False`) but is
  all-null in the current dataset.
- **EPA GHGRP limits**: Scope 1 (direct) only, US facilities only (a
  multinational's overseas emissions aren't captured, so this undercounts
  true global Scope 1 for internationally-heavy companies), and only
  facilities above the 25,000 ton/yr threshold (diversified companies with
  many small/leased sites may show zero qualifying facilities despite having
  some real footprint). Matching is exact-string on a normalized free-text
  "parent company" field (no ticker/CIK in EPA's data), restricted to >=50%
  ownership stakes to exclude passive minority financial owners (confirmed
  case: BlackRock showed up as a 49%-stake "parent" of a power plant before
  this filter). Majority stakes acquired via investment/infrastructure funds
  still pass the filter and can attribute industrial emissions to an asset
  manager (e.g. Ares Management, 80%-owner of a power facility) -- a
  defensible reading of "who's the controlling owner" but not necessarily
  what most people mean by "the company's own operations."
- **Wikirate is crowd-sourced and has occasional unit errors.** Found and
  patched one during review: Mosaic's (MOS) 2020 Scope 1/2 entries were off
  by a factor of ~1,000,000 relative to its 2021 entries. `MOS`'s absolute
  emissions figures use its 2021 (correct-unit) values; watch for similar
  issues if re-running and getting new outlier values.
- **Different sources are snapshotted at different times.** The ticker list
  reflects current S&P 500 constituents (Wikipedia); the Kaggle controversy
  data and Wikirate's environmental disclosures are each snapshotted whenever
  they were last updated upstream.
- Missing values are always `null`/empty, never `0` -- a `0` means the source
  actually reported zero.
