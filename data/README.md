# S&P 500 financials / social / environmental dataset

`out/sp500_esg_financials_zscores.csv` is the deliverable: one row per
current S&P 500 constituent, with identifiers plus a sector-relative
z-score column for each variable (z = (value - sector mean) / sector std,
grouped by GICS sector -- comparing a bank's leverage ratio to a tech
company's isn't meaningful otherwise). This file ships z-scores only --
no raw values -- by design.

Built by the scripts in `pipeline/`, run in order (`01_` through `06_`).
Requires Python 3.11+; install deps with `pip install -r pipeline/requirements.txt`.
Intermediate per-source CSVs (universe/financials/social/environmental) are
not kept in this repo -- only the final merged+scored output is.

## Credentials needed to re-run the pipeline

- **Kaggle** (`03_fetch_social.py`, controversy/reputation column only): create
  a free account, Account > Create New API Token, save the downloaded
  `kaggle.json` to `~/.kaggle/kaggle.json`.
- **Wikirate** (`04_fetch_environmental.py`): create a free account at
  wikirate.org, generate an API key from your profile's Accounts tab, and set
  it as the `WIKIRATE_API_KEY` environment variable before running the script.
  Wikirate rate-limits aggressively (~58 rapid requests before a 429); the
  script paces requests to stay under that.

Both scripts degrade gracefully (leave the relevant columns null) if
credentials aren't present, so the pipeline can still run end-to-end without
them.

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
- **Environmental** (source: Wikirate API, most recently disclosed fiscal
  year per company -- inherently 1-4yr lagged since no source publishes
  real-time emissions): `scope1_tco2e`, `scope2_tco2e`,
  `scope1_2_total_tco2e`, `emissions_intensity_per_revenue` (derived:
  scope1+2 divided by annualized quarterly revenue -- approximate, since the
  emissions year and the financial quarter are different periods), and
  `renewable_fuel_pct` (disabled in the current run -- see Known gaps, so its
  z-score is all-null).

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
- **Environmental coverage is partial.** ~90% of tickers matched a Wikirate
  company record (via SEC CIK), but only ~23% have an actual Scope 1+2
  disclosure logged. Renewable-fuel data was dropped from this run to cut API
  call volume; the field exists in the code (`FETCH_RENEWABLE = False`) but
  is all-null in the current dataset.
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
