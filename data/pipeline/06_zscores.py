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

IN_PATH = "../out/sp500_esg_financials.csv"  # output of 05_merge.py
OUT_PATH = "../out/sp500_esg_financials_zscores.csv"
MIN_GROUP_SIZE = 3
ID_COLUMNS = ["ticker", "company_name", "sector", "sub_industry"]

# Pure pipeline debug artifacts, not data -- dropped before scoring/shipping.
DEBUG_COLUMNS = ["fetch_error_x", "fetch_error_y", "employees_fetch_error"]

CONTROVERSY_ORDER = {
    "None Controversy Level": 0,
    "Low Controversy Level": 1,
    "Moderate Controversy Level": 2,
    "Significant Controversy Level": 3,
    "High Controversy Level": 4,
    "Severe Controversy Level": 5,
}

ZSCORE_VARS = [
    # raw financial inputs
    "revenue_q",
    "net_income_q",
    "ebitda_q",
    "total_assets_q",
    "net_debt_q",
    "free_cash_flow_q",
    # financial ratios
    "asset_turnover",
    "profit_to_revenue",
    "fcf_to_revenue",
    "net_debt_to_ebitda",
    # social
    "full_time_employees",
    "total_esg_risk_score",
    "controversy_score_ordinal",
    # environmental
    "scope1_tco2e",
    "scope2_tco2e",
    "scope1_2_total_tco2e",
    "renewable_fuel_pct",
    "emissions_intensity_per_revenue",
]

# Excluded on purpose: identifiers (ticker/company_name/sector/sub_industry),
# dates and year labels (quarter_end, scope1_year, scope2_year,
# renewable_fuel_pct_year), and the wikirate_matched data-quality flag --
# none of these are "how does this company compare to peers" variables, so a
# z-score of them wouldn't mean anything.


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
    df = df.drop(columns=[c for c in DEBUG_COLUMNS if c in df.columns])

    df["controversy_score_ordinal"] = df["controversy_level"].map(CONTROVERSY_ORDER)

    # Quarterly revenue annualized (x4) as a rough denominator -- the emissions
    # year and the financials quarter are not the same period, so this is an
    # approximation, documented in README.md.
    annualized_revenue = df["revenue_q"] * 4
    df["emissions_intensity_per_revenue"] = df["scope1_2_total_tco2e"] / annualized_revenue.replace(0, np.nan)

    for var in ZSCORE_VARS:
        df[f"{var}_zscore"] = sector_zscore(df, var)

    # Ship z-scores only, not the raw values -- per requirement, this is a
    # sector-relative comparison dataset, not a raw-data dataset.
    zscore_cols = [f"{var}_zscore" for var in ZSCORE_VARS]
    df = df[ID_COLUMNS + zscore_cols]

    df.to_csv(OUT_PATH, index=False)

    print(f"Wrote {len(df)} rows to {OUT_PATH}")
    for col in zscore_cols:
        n = df[col].notna().sum()
        print(f"  {col}: {n}/{len(df)} non-null")


if __name__ == "__main__":
    main()
