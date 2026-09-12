"""
Financials & Operating variables, from each company's most recently reported
quarter (single quarter, not trailing-twelve-months), via yfinance.

Variables: asset turnover, profit/revenue, free cash flow/revenue, Net Debt/EBITDA.

Output: data/out/financials.csv -- exactly one row per ticker in the universe,
with nulls where a figure couldn't be retrieved.
"""
import time

import pandas as pd
import yfinance as yf

UNIVERSE_PATH = "../out/universe.csv"
OUT_PATH = "../out/financials.csv"
SLEEP_SECONDS = 0.3


def anchor_column(df: pd.DataFrame, anchor_row: str):
    """Yahoo sometimes posts a placeholder column for the newest quarter with
    only EPS/share-count filled in before the full statement lands (seen live
    for AMZN/BAC/ADBE: latest column had 42 of 46 rows null). Anchoring on the
    first column where the statement's headline row actually has a value
    avoids silently returning nulls for a quarter that isn't really populated
    yet."""
    if df is None or df.empty or anchor_row not in df.index:
        return None
    for col in df.columns:
        if pd.notna(df.loc[anchor_row, col]):
            return col
    return None


def value_at(df: pd.DataFrame, row_name: str, col) -> float | None:
    if df is None or df.empty or col is None or row_name not in df.index:
        return None
    val = df.loc[row_name, col]
    return None if pd.isna(val) else float(val)


def fetch_one(ticker: str) -> dict:
    row = {
        "ticker": ticker,
        "quarter_end": None,
        "revenue_q": None,
        "net_income_q": None,
        "ebitda_q": None,
        "total_assets_q": None,
        "net_debt_q": None,
        "free_cash_flow_q": None,
        "asset_turnover": None,
        "profit_to_revenue": None,
        "fcf_to_revenue": None,
        "net_debt_to_ebitda": None,
        "fetch_error": None,
    }
    try:
        t = yf.Ticker(ticker)
        q_inc = t.quarterly_income_stmt
        q_bs = t.quarterly_balance_sheet
        q_cf = t.quarterly_cashflow

        inc_col = anchor_column(q_inc, "Total Revenue") or anchor_column(q_inc, "Operating Revenue")
        bs_col = anchor_column(q_bs, "Total Assets")
        cf_col = anchor_column(q_cf, "Free Cash Flow")

        revenue = value_at(q_inc, "Total Revenue", inc_col)
        if revenue is None:
            revenue = value_at(q_inc, "Operating Revenue", inc_col)
        net_income = value_at(q_inc, "Net Income", inc_col)
        ebitda = value_at(q_inc, "EBITDA", inc_col)
        total_assets = value_at(q_bs, "Total Assets", bs_col)
        net_debt = value_at(q_bs, "Net Debt", bs_col)
        if net_debt is None:
            # Yahoo doesn't always compute this derived row even when its
            # inputs are present (confirmed for ACN: Total Debt and Cash And
            # Cash Equivalents both exist, Net Debt row is simply absent) --
            # fall back to computing it ourselves from the same anchor column.
            total_debt = value_at(q_bs, "Total Debt", bs_col)
            cash = value_at(q_bs, "Cash And Cash Equivalents", bs_col)
            if cash is None:
                cash = value_at(q_bs, "Cash Cash Equivalents And Short Term Investments", bs_col)
            if total_debt is not None and cash is not None:
                net_debt = total_debt - cash
        fcf = value_at(q_cf, "Free Cash Flow", cf_col)

        row.update({
            "quarter_end": inc_col.date().isoformat() if inc_col is not None else None,
            "revenue_q": revenue,
            "net_income_q": net_income,
            "ebitda_q": ebitda,
            "total_assets_q": total_assets,
            "net_debt_q": net_debt,
            "free_cash_flow_q": fcf,
        })

        if revenue:
            if total_assets:
                row["asset_turnover"] = revenue / total_assets
            row["profit_to_revenue"] = (net_income / revenue) if net_income is not None else None
            row["fcf_to_revenue"] = (fcf / revenue) if fcf is not None else None
        if ebitda:
            row["net_debt_to_ebitda"] = (net_debt / ebitda) if net_debt is not None else None

    except Exception as exc:  # noqa: BLE001 -- one bad ticker must not kill the run
        row["fetch_error"] = str(exc)

    return row


def main():
    universe = pd.read_csv(UNIVERSE_PATH)
    tickers = universe["ticker"].tolist()

    rows = []
    for i, ticker in enumerate(tickers, start=1):
        rows.append(fetch_one(ticker))
        if i % 25 == 0 or i == len(tickers):
            print(f"[{i}/{len(tickers)}] fetched {ticker}")
        time.sleep(SLEEP_SECONDS)

    df = pd.DataFrame(rows)

    assert df["ticker"].is_unique, "financials must have exactly one row per ticker"
    missing = set(universe["ticker"]) - set(df["ticker"])
    assert not missing, f"missing tickers from financials output: {missing}"

    df.to_csv(OUT_PATH, index=False)
    n_errors = df["fetch_error"].notna().sum()
    print(f"Wrote {len(df)} rows to {OUT_PATH} ({n_errors} tickers had fetch errors)")


if __name__ == "__main__":
    main()
