"""
Core entropy-weighted TOPSIS scoring engine for the Sustainability
Evaluator. Pure functions only, no file I/O, so every function here is
independently unit-testable (see tests/test_score_engine.py) without a
database or the real dataset.

Blueprint: sustainability-evaluator-blueprint-v1.4.pdf, sections 3, 5-10.
Sections 3, 5, 6, 7, 8 of that document are marked "Locked" -- any change
to the math here needs a decisions-log entry. Three such changes are
already made and recorded in this plan's Global Constraints
(docs/superpowers/plans/2026-09-13-sustainability-evaluator.md): no
company is ever excluded from the ranking, no imputation is surfaced to
the user, and the 0.05 disclosure penalty is kept but applied silently.

Reference ranges below are frozen constants, checked against the real
503-company dataset (data/out/sp500_esg_financials_raw.csv) on
2026-09-13, per the written-justification requirement in blueprint
section 6.1:

- env_intensity (Scope 1+2 tCO2e per USD million revenue, log-transformed,
  cost): floor=1.0 (so log >= 0; real data's minimum non-null value is
  0.105, so this floor legitimately compresses a handful of very-clean
  companies to the same best score rather than fabricating a distinction
  the data can't support). hi = ln(97.5th percentile of the real
  distribution) = ln(2344.84) = 7.7599, frozen at first run.
- esg_risk (Sustainalytics Total ESG Risk Score, cost): lo=0, hi=40, the
  vendor's own documented "severe risk" threshold -- kept as-is even
  though 4 real companies score slightly above it (41.7 max); those clip
  to the worst score, which is correct behaviour for a documented
  external ceiling.
- controversy (Sustainalytics controversy level mapped to the 0-5
  ordinal scale already computed in this repo as
  `controversy_score_ordinal`, cost): lo=0, hi=5, the vendor's own
  documented ordinal bound.
- asset_turnover (benefit): lo=0, hi=97.5th percentile of the real
  distribution = 0.6306, frozen at first run (open-ended ratio, no
  natural ceiling per blueprint).
- profit_margin (net margin, benefit): lo=-0.20, the blueprint's example
  distress floor -- checked against real data: only 1.79% of companies
  fall below it, confirming it catches a genuine tail rather than the
  bulk of the index. hi = 97.5th percentile = 0.5209, frozen.
- fcf_margin (benefit): lo=-0.20, same distress floor as profit_margin
  for consistency -- checked: 4.79% of real companies fall below it,
  still a minority tail. hi = 97.5th percentile = 0.6033, frozen.
- leverage (Net debt/EBITDA, target t=1.5, converted to cost via
  d=|x-t|): lo=0, hi=26.8178. The blueprint's own table lists this as
  provisional ("largest distance considered, e.g. 5") pending the real-
  data check section 6.1 requires. That check: at hi=5, 53% of real
  companies would have d > 5 and clip to the worst possible leverage
  score -- not defensible. There's no documented external ceiling for
  this distance (unlike esg_risk's vendor threshold), so per section 6's
  fallback rule the ceiling is set to the 97.5th percentile of the real
  distance distribution instead: 26.8178, frozen at first run. (Real data
  also has one extreme outlier, -603.24, from a near-zero-EBITDA
  denominator; the percentile ceiling naturally clips it without special
  handling, and the winsorised copy in `entropy_weights` below prevents
  it from distorting the leverage axis's weight.)

Correlation check (blueprint section 4 gate, run once against the real,
final normalised+penalised matrix): max |r| = 0.455 (env vs esg_risk).
All 7 variables kept, none dropped -- well under the 0.8 threshold.

Entropy-vs-CRITIC decision (blueprint section 7.1): entropy weights on
the real first run range from 4.6% to 36.9%, none reaching the 0.40 cap
-- not lopsided or unstable, so entropy is kept; the CRITIC fallback is
not needed. (`entropy_weights` below still applies the cap/guardrail
unconditionally, since blueprint section 7.1 requires it regardless of
whether it triggers on any given run's data.)
"""
import numpy as np
import pandas as pd

REFERENCE_RANGES = {
    "env_intensity": dict(kind="log_cost", floor=1.0, lo=0.0, hi=7.7599),
    "esg_risk": dict(kind="cost", lo=0.0, hi=40.0),
    "controversy": dict(kind="cost", lo=0.0, hi=5.0),
    "asset_turnover": dict(kind="benefit", lo=0.0, hi=0.6306),
    "profit_margin": dict(kind="benefit", lo=-0.20, hi=0.5209),
    "fcf_margin": dict(kind="benefit", lo=-0.20, hi=0.6033),
    "leverage": dict(kind="target", target=1.5, lo=0.0, hi=26.8178),
}

# score_engine variable name -> raw column name in
# data/out/sp500_esg_financials_raw.csv. env_intensity's raw column
# (env_intensity_per_million) is derived in 09_score.py from the
# existing emissions_intensity_per_revenue column (* 1e6, to get tCO2e
# per USD million revenue instead of per USD).
RAW_COLUMNS = {
    "env_intensity": "env_intensity_per_million",
    "esg_risk": "total_esg_risk_score",
    "controversy": "controversy_score_ordinal",
    "asset_turnover": "asset_turnover",
    "profit_margin": "profit_to_revenue",
    "fcf_margin": "fcf_to_revenue",
    "leverage": "net_debt_to_ebitda",
}

DISCLOSURE_PENALTY = 0.05
WEIGHT_CAP = 0.40
WINSOR_LO, WINSOR_HI = 0.025, 0.975


def normalize_benefit(x: pd.Series, lo: float, hi: float) -> pd.Series:
    """Section 5: benefit variable, more is better. 1 = best."""
    return (x.clip(lower=lo, upper=hi) - lo) / (hi - lo)


def normalize_cost(x: pd.Series, lo: float, hi: float) -> pd.Series:
    """Section 5: cost variable, less is better. 1 = best."""
    return (hi - x.clip(lower=lo, upper=hi)) / (hi - lo)


def normalize_log_cost(x: pd.Series, floor: float, lo: float, hi: float) -> pd.Series:
    """Section 6: heavy-tailed cost variable, log-transformed before the
    fixed-range normalisation described in normalize_cost."""
    logged = np.log(x.clip(lower=floor))
    return normalize_cost(logged, lo, hi)


def normalize_target_as_cost(x: pd.Series, target: float, lo: float, hi: float) -> pd.Series:
    """Section 5: target variable with an optimum in the middle. Converted
    to a distance-from-target, then treated as a cost (less distance is
    better)."""
    distance = (x - target).abs()
    return normalize_cost(distance, lo, hi)


def impute_sector_median(df: pd.DataFrame, sector_col: str, raw_col: str) -> tuple[pd.Series, pd.Series]:
    """Section 6: a missing value is filled with the company's GICS-sector
    median for that variable -- never dropped. Returns (filled, missing)
    where `missing` is a boolean mask kept for internal use only (the
    disclosure penalty in normalize_all below); per this plan's Global
    Constraints it must never be surfaced to the user."""
    sector_median = df.groupby(sector_col)[raw_col].transform("median")
    missing = df[raw_col].isna()
    filled = df[raw_col].where(~missing, sector_median)
    return filled, missing
