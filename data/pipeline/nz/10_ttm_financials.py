"""
Trailing-twelve-month financials, float-adjusted market cap and latest price for every
S&P 500 constituent (spec D8, D16), via yfinance.

TTM = sum of the last four reported quarters, anchored on the first quarter whose headline
row is populated (Yahoo posts placeholder columns). Net debt is the latest balance sheet value,
falling back to total debt minus cash exactly like 02_fetch_financials.py.

Run from data/pipeline/nz:  uv run python 10_ttm_financials.py
Output: ../../out/nz/financials_ttm.csv -- exactly one row per ticker.

--recap-only re-applies the D16 listed-line float cap (nzlib.financials.cap_at_listed_line) to
the existing CSV's float_cap/cap_flag columns using its own price and shares_outstanding
columns, with no yfinance calls -- for fixing already-fetched data (e.g. GOOGL/GOOG, BRK-B)
without a full rerun:  uv run python 10_ttm_financials.py --recap-only
"""
import argparse
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

from nzlib.financials import anchor_columns, cap_at_listed_line, float_cap, ttm_sum

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
        price = info.get("currentPrice") or info.get("regularMarketPreviousClose")
        shares_outstanding = info.get("sharesOutstanding")
        cap, cap_flag = float_cap(info.get("marketCap"), info.get("floatShares"), shares_outstanding, price=price)
        row.update(
            revenue_ttm=revenue,
            ebitda_ttm=ttm_sum(income, "EBITDA", income_cols),
            fcf_ttm=ttm_sum(cashflow, "Free Cash Flow", anchor_columns(cashflow, "Free Cash Flow")),
            net_debt=net_debt,
            price=price,
            shares_outstanding=shares_outstanding,
            float_cap=cap,
            cap_flag=cap_flag,
        )
    except Exception as exc:  # noqa: BLE001 -- one bad ticker must not kill the run
        row["fetch_error"] = str(exc)
    return row


def recap_only():
    """Idempotent re-cap: reapply cap_at_listed_line to the existing CSV, no yfinance calls."""
    # float_precision="round_trip" avoids pandas' default fast float parser, which loses a few
    # ULPs on read and would otherwise perturb every row's float columns on write, not just the
    # ones actually recapped.
    df = pd.read_csv(OUT_PATH, float_precision="round_trip")
    before = df["float_cap"].copy()
    new_caps, new_flags = [], []
    for row in df.itertuples():
        flag = None if pd.isna(row.cap_flag) else row.cap_flag
        price = None if pd.isna(row.price) else row.price
        shares = None if pd.isna(row.shares_outstanding) else row.shares_outstanding
        cap = None if pd.isna(row.float_cap) else row.float_cap
        new_cap, new_flag = cap_at_listed_line(cap, flag, price, shares)
        new_caps.append(new_cap)
        new_flags.append(new_flag)
    df["float_cap"] = new_caps
    df["cap_flag"] = new_flags
    changed = df[before.ne(df["float_cap"]) & before.notna()]
    df.to_csv(OUT_PATH, index=False)
    print(f"Re-capped {len(changed)}/{len(df)} rows in {OUT_PATH}")
    if len(changed):
        report = pd.DataFrame({"ticker": changed["ticker"], "before": before[changed.index], "after": changed["float_cap"]})
        print(report.sort_values("before", ascending=False).to_string(index=False))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--recap-only",
        action="store_true",
        help="Re-apply the D16 listed-line float cap to the existing CSV without refetching from yfinance.",
    )
    args = parser.parse_args()
    if args.recap_only:
        recap_only()
        return

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
