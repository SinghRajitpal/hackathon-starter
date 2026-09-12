"""
Sector-relative z-scores for every analysis variable: z = (value - sector
mean) / sector standard deviation, grouped by GICS sector. Lets you compare
a company against its actual peers instead of the whole index (comparing a
bank's Net Debt/EBITDA to a tech company's is meaningless -- see README).

Also derives one variable not computed upstream: emissions intensity per $
revenue (scope1_2_total_tco2e / annualized quarterly revenue), since the
environmental fetch only produced the absolute total.

Input: data/out/sp500_esg_financials.csv (output of 05_merge.py)
Output: data/out/sp500_esg_financials_zscores.csv -- all original columns
plus one "<variable>_zscore" column per variable below, computed within
each row's sector. Null in, null z-score out; sectors with fewer than 3
non-null values for a variable also get a null z-score (std is too
unstable to be meaningful below that).
"""
import numpy as np
import pandas as pd

IN_PATH = "../out/sp500_esg_financials.csv"
OUT_PATH = "../out/sp500_esg_financials_zscores.csv"
MIN_GROUP_SIZE = 3

CONTROVERSY_ORDER = {
    "None Controversy Level": 0,
    "Low Controversy Level": 1,
    "Moderate Controversy Level": 2,
    "Significant Controversy Level": 3,
    "High Controversy Level": 4,
    "Severe Controversy Level": 5,
}

ZSCORE_VARS = [
    "asset_turnover",
    "profit_to_revenue",
    "fcf_to_revenue",
    "net_debt_to_ebitda",
    "full_time_employees",
    "total_esg_risk_score",
    "controversy_score_ordinal",
    "scope1_2_total_tco2e",
    "emissions_intensity_per_revenue",
]


def sector_zscore(df: pd.DataFrame, column: str) -> pd.Series:
    def _z(group: pd.Series) -> pd.Series:
        n = group.notna().sum()
        std = group.std(ddof=1)
        if n < MIN_GROUP_SIZE or not std:
            return pd.Series(np.nan, index=group.index)
        return (group - group.mean()) / std

    return df.groupby("sector")[column].transform(_z)


def main():
    df = pd.read_csv(IN_PATH)

    df["controversy_score_ordinal"] = df["controversy_level"].map(CONTROVERSY_ORDER)

    # Quarterly revenue annualized (x4) as a rough denominator -- the emissions
    # year and the financials quarter are not the same period, so this is an
    # approximation, documented in README.md.
    annualized_revenue = df["revenue_q"] * 4
    df["emissions_intensity_per_revenue"] = df["scope1_2_total_tco2e"] / annualized_revenue.replace(0, np.nan)

    for var in ZSCORE_VARS:
        df[f"{var}_zscore"] = sector_zscore(df, var)

    df.to_csv(OUT_PATH, index=False)

    print(f"Wrote {len(df)} rows to {OUT_PATH}")
    for var in ZSCORE_VARS:
        n = df[f"{var}_zscore"].notna().sum()
        print(f"  {var}_zscore: {n}/{len(df)} non-null")


if __name__ == "__main__":
    main()
