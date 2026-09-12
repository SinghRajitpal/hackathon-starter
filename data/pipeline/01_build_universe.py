"""
Build the canonical list of current S&P 500 constituents.
Output: data/out/universe.csv -- exactly one row per ticker.
"""
import io

import pandas as pd
import requests

WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
OUT_PATH = "../out/universe.csv"
HEADERS = {"User-Agent": "Mozilla/5.0 (data pipeline research script)"}


def normalize_ticker(ticker: str) -> str:
    # yfinance uses '-' for share classes (e.g. BRK-B), Wikipedia uses '.'
    return ticker.strip().upper().replace(".", "-")


def main():
    resp = requests.get(WIKI_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    tables = pd.read_html(io.StringIO(resp.text))
    constituents = tables[0]

    df = pd.DataFrame({
        "ticker": constituents["Symbol"].map(normalize_ticker),
        "company_name": constituents["Security"],
        "sector": constituents["GICS Sector"],
        "sub_industry": constituents["GICS Sub-Industry"],
    })

    before = len(df)
    df = df.drop_duplicates(subset="ticker", keep="first").reset_index(drop=True)
    if len(df) != before:
        print(f"Dropped {before - len(df)} duplicate ticker rows")

    assert df["ticker"].is_unique, "universe must have exactly one row per ticker"

    df.to_csv(OUT_PATH, index=False)
    print(f"Wrote {len(df)} tickers to {OUT_PATH}")


if __name__ == "__main__":
    main()
