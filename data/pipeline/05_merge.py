"""
Joins universe + financials + social + environmental into one dataset.
Output: data/out/sp500_esg_financials.csv -- exactly one row per ticker.
"""
import pandas as pd

UNIVERSE_PATH = "../out/universe.csv"
FINANCIALS_PATH = "../out/financials.csv"
SOCIAL_PATH = "../out/social.csv"
ENVIRONMENTAL_PATH = "../out/environmental.csv"
OUT_PATH = "../out/sp500_esg_financials.csv"


def main():
    universe = pd.read_csv(UNIVERSE_PATH)
    financials = pd.read_csv(FINANCIALS_PATH)
    social = pd.read_csv(SOCIAL_PATH)

    df = universe.merge(financials, on="ticker", how="left")
    df = df.merge(social, on="ticker", how="left")

    try:
        environmental = pd.read_csv(ENVIRONMENTAL_PATH)
        df = df.merge(environmental, on="ticker", how="left")
    except FileNotFoundError:
        print(f"{ENVIRONMENTAL_PATH} not found yet -- shipping without environmental columns")

    assert df["ticker"].is_unique, "final dataset must have exactly one row per ticker"
    assert len(df) == len(universe), "row count must match universe (no fan-out from joins)"

    df.to_csv(OUT_PATH, index=False)
    print(f"Wrote {len(df)} rows x {len(df.columns)} columns to {OUT_PATH}")


if __name__ == "__main__":
    main()
