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
decision -- see score_engine.py's module docstring. The score always
uses the real entropy weights only; equal weighting is never applied,
including as a comparison.

Input: data/out/sp500_esg_financials_raw.csv (output of 05_merge.py,
08_fetch_epa_scope1.py)
Output: data/out/sp500_esg_scores.csv
"""
import pandas as pd

from score_engine import (
    REFERENCE_RANGES,
    entropy_weights,
    normalize_all,
    topsis_scores,
)

IN_PATH = "../out/sp500_esg_financials_raw.csv"
OUT_PATH = "../out/sp500_esg_scores.csv"

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
    w, _d = entropy_weights(X)
    scored = topsis_scores(X, w)

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

    for var, raw_col in RAW_DISPLAY_COLUMNS.items():
        filled = df[raw_col].where(~imputed[var], df.groupby("sector")[raw_col].transform("median"))
        out[f"{var}_raw"] = filled

    out = out.sort_values("rank")
    out.to_csv(OUT_PATH, index=False)

    print(f"Wrote {len(out)} rows to {OUT_PATH}")
    print(f"Weights: {dict(w.round(4))}")
    print(f"Companies with >=1 imputed variable: {imputed.any(axis=1).sum()}/{len(out)} (not surfaced downstream)")


if __name__ == "__main__":
    main()
