"""
Trailing-twelve-month financials, float-adjusted market cap and latest price for every
S&P 500 constituent (spec D8, D16), via yfinance.

TTM = sum of the last four reported quarters, anchored on the first quarter whose headline
row is populated (Yahoo posts placeholder columns). Net debt is the latest balance sheet value,
falling back to total debt minus cash exactly like 02_fetch_financials.py.

Run from data/pipeline/nz:  uv run python 10_ttm_financials.py
Output: ../../out/nz/financials_ttm.csv -- exactly one row per ticker.
"""
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

from nzlib.financials import anchor_columns, float_cap, ttm_sum

UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
OUT_PATH = Path("../../out/nz/financials_ttm.csv")
SLEEP_SECONDS = 0.3


def latest_value(df: pd.DataFrame | None, row: str) -> float | None:
    if df is None or df.empty or row not in df.index:
        return None
    values = df.loc[row].dropna()
    return float(values.iloc[0]) if len(values) else None


def fetch_one(ticker: str) -> dict:
    row = {
        "ticker": ticker,
        "revenue_ttm": None,
        "ebitda_ttm": None,
        "fcf_ttm": None,
        "net_debt": None,
        "price": None,
        "shares_outstanding": None,
        "float_cap": None,
        "cap_flag": None,
        "fetch_error": None,
    }
    try:
        t = yf.Ticker(ticker)
        income, cashflow, balance = t.quarterly_income_stmt, t.quarterly_cashflow, t.quarterly_balance_sheet
        income_cols = anchor_columns(income, "Total Revenue") or anchor_columns(income, "Operating Revenue")
        revenue = ttm_sum(income, "Total Revenue", income_cols)
        if revenue is None:
            revenue = ttm_sum(income, "Operating Revenue", income_cols)

        net_debt = latest_value(balance, "Net Debt")
        if net_debt is None:
            debt = latest_value(balance, "Total Debt")
            cash = latest_value(balance, "Cash And Cash Equivalents")
            if cash is None:
                cash = latest_value(balance, "Cash Cash Equivalents And Short Term Investments")
            if debt is not None and cash is not None:
                net_debt = debt - cash

        info = t.info
        cap, cap_flag = float_cap(info.get("marketCap"), info.get("floatShares"), info.get("sharesOutstanding"))
        row.update(
            revenue_ttm=revenue,
            ebitda_ttm=ttm_sum(income, "EBITDA", income_cols),
            fcf_ttm=ttm_sum(cashflow, "Free Cash Flow", anchor_columns(cashflow, "Free Cash Flow")),
            net_debt=net_debt,
            price=info.get("currentPrice") or info.get("regularMarketPreviousClose"),
            shares_outstanding=info.get("sharesOutstanding"),
            float_cap=cap,
            cap_flag=cap_flag,
        )
    except Exception as exc:  # noqa: BLE001 -- one bad ticker must not kill the run
        row["fetch_error"] = str(exc)
    return row


def main():
    universe = pd.read_csv(UNIVERSE_PATH)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, ticker in enumerate(universe["ticker"], start=1):
        rows.append(fetch_one(ticker))
        if i % 25 == 0 or i == len(universe):
            print(f"[{i}/{len(universe)}] fetched {ticker}")
        time.sleep(SLEEP_SECONDS)

    df = pd.DataFrame(rows)
    assert df["ticker"].is_unique, "financials_ttm must have one row per ticker"
    assert set(df["ticker"]) == set(universe["ticker"]), "financials_ttm is missing tickers"
    df.to_csv(OUT_PATH, index=False)
    print(
        f"Wrote {len(df)} rows to {OUT_PATH}: revenue {df['revenue_ttm'].notna().sum()}, "
        f"EBITDA {df['ebitda_ttm'].notna().sum()}, float cap {df['float_cap'].notna().sum()}, "
        f"errors {df['fetch_error'].notna().sum()}"
    )


if __name__ == "__main__":
    main()
