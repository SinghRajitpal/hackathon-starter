"""
Computes the Sustainability Evaluator score for every company in
data/out/sp500_esg_financials_raw.csv using score_engine.py (blueprint
sections 5-10), and writes data/out/sp500_esg_scores.csv.

Sector rank is a display-time renumbering of this same universal
ranking (blueprint section 9) -- not a second weighting pass. No
`imputed` column is written here: per this plan's Global Constraints
(docs/superpowers/plans/2026-09-13-sustainability-evaluator.md), no
company is excluded and no imputation is ever surfaced downstream.
Both of section 10's robustness outputs (rank stability and
weight-vs-equal-weights delta) are dropped per a 2026-09-13 user
decision -- see score_engine.py's module docstring.

The score uses score_engine.MANUAL_WEIGHTS, a user-directed manual
override, NOT the entropy_weights() output -- see score_engine.py's
module docstring for the full derivation (Financial pillar cut from
73.33% to 53%, entirely out of asset_turnover). entropy_weights() is
still computed and printed below purely for traceability, since it's
the baseline MANUAL_WEIGHTS was derived from.

Input: data/out/sp500_esg_financials_raw.csv (output of 05_merge.py,
08_fetch_epa_scope1.py)
Output: data/out/sp500_esg_scores.csv
"""
import pandas as pd

from score_engine import (
    MANUAL_WEIGHTS,
    PILLARS,
    REFERENCE_RANGES,
    entropy_weights,
    normalize_all,
    pillar_scores,
    topsis_scores,
)

IN_PATH = "../out/sp500_esg_financials_raw.csv"
OUT_PATH = "../out/sp500_esg_scores.csv"
CORRELATION_OUT_PATH = "../out/sp500_esg_correlation.csv"

ID_COLUMNS = ["ticker", "company_name", "sector", "sub_industry"]

RAW_DISPLAY_COLUMNS = {
    "env_intensity": "env_intensity_per_million",
    "esg_risk": "total_esg_risk_score",
    "controversy": "controversy_score_ordinal",
    "asset_turnover": "asset_turnover",
    "profit_margin": "profit_to_revenue",
    "fcf_margin": "fcf_to_revenue",
    "leverage": "net_debt_to_ebitda",
}


def main():
    df = pd.read_csv(IN_PATH)

    # env_intensity's raw column, in tCO2e per USD million revenue --
    # derived here from the existing emissions_intensity_per_revenue
    # column (tCO2e per USD), see score_engine.py's module docstring.
    df["env_intensity_per_million"] = df["emissions_intensity_per_revenue"] * 1e6

    X, imputed = normalize_all(df)
    w_entropy, _d = entropy_weights(X)  # traceability only, not used for scoring
    w = pd.Series(MANUAL_WEIGHTS).reindex(X.columns)
    w = w / w.sum()
    scored = topsis_scores(X, w)
    pillars = pillar_scores(X, w)

    out = df[ID_COLUMNS].copy()
    out["score"] = scored["score"]
    out["rank"] = scored["score"].rank(ascending=False, method="min").astype(int)
    out["sector_rank"] = (
        out.groupby("sector")["score"].rank(ascending=False, method="min").astype(int)
    )
    out["d_plus"] = scored["d_plus"]
    out["d_minus"] = scored["d_minus"]

    for var in REFERENCE_RANGES:
        out[f"weight_{var}"] = w[var]
        out[f"contrib_{var}"] = scored[f"contrib_{var}"]

    for pillar_name in PILLARS:
        out[f"pillar_{pillar_name}_score"] = pillars[pillar_name]

    for var, raw_col in RAW_DISPLAY_COLUMNS.items():
        filled = df[raw_col].where(~imputed[var], df.groupby("sector")[raw_col].transform("median"))
        out[f"{var}_raw"] = filled

    # Section 10: "percentile within the index and within the sector".
    # rank 1 (best) -> 100th percentile; rank n (worst) -> 0th.
    n_index = len(out)
    out["percentile_index"] = 100.0 * (n_index - out["rank"]) / (n_index - 1)
    sector_size = out.groupby("sector")["sector_rank"].transform("size")
    out["percentile_sector"] = 100.0 * (sector_size - out["sector_rank"]) / (sector_size - 1).replace(0, 1)

    out = out.sort_values("rank")
    out.to_csv(OUT_PATH, index=False)

    # Section 4/10: correlation matrix used to prune the variable set,
    # computed once against the final normalised+penalised matrix and
    # frozen here (see score_engine.py's module docstring for the
    # highest pair on the real first run).
    X.corr().round(4).to_csv(CORRELATION_OUT_PATH)

    print(f"Wrote {len(out)} rows to {OUT_PATH}")
    print(f"Wrote correlation matrix to {CORRELATION_OUT_PATH}")
    print(f"Manual weights (used for scoring): {dict(w.round(4))}")
    print(f"Entropy weights (traceability only, not used): {dict(w_entropy.round(4))}")
    print(f"Companies with >=1 imputed variable: {imputed.any(axis=1).sum()}/{len(out)} (not surfaced downstream)")


if __name__ == "__main__":
    main()
