"""PDF §11 validation: 2019 transition burden vs change in emissions intensity 2019 → latest.

Hypothesis: companies with a low 2019 burden decarbonised faster because it was cheaper for them.
GHGRP (US facilities, Scope 1 split into combustion/process/fugitive) is used for both years so the
comparison is like for like. FY2019 revenue and EBITDA come from SEC companyfacts; the latest
intensity uses TTM revenue from 10_ttm_financials.py. Two-hour time box (see the P8 plan).

Usage (from data/pipeline/nz):
  SEC_USER_AGENT="Your Name your@email" uv run python -u 18_validation_2019.py
Output: ../../out/nz/validation_2019.csv
"""
import json
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

from nzlib import validation

UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
GHGRP_PATH = Path("../../out/nz/ghgrp_categories.csv")
FINANCIALS_PATH = Path("../../out/nz/financials_ttm.csv")
MAC_PATH = Path("maps/mac_costs.csv")
CACHE_DIR = Path("../../raw/nz/companyfacts")
OUT_PATH = Path("../../out/nz/validation_2019.csv")

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"
SLEEP_SECONDS = 0.15  # stays under SEC's 10 requests/second fair-access limit
SCOPE1_CATEGORIES = ["combustion", "process", "fugitive"]
BASE_YEAR = 2019
LATEST_YEAR = 2023


def normalise_ticker(ticker: str) -> str:
    return str(ticker).upper().replace("-", ".")


def load_facts(session: requests.Session, cik: int) -> dict | None:
    """companyfacts JSON, cached on disk so reruns make no requests."""
    path = CACHE_DIR / f"CIK{cik:010d}.json"
    if path.exists():
        return json.loads(path.read_text())
    time.sleep(SLEEP_SECONDS)
    response = session.get(FACTS_URL.format(cik=cik), timeout=60)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    path.write_text(response.text)
    return response.json()


def main():
    user_agent = os.environ.get("SEC_USER_AGENT")
    if not user_agent:
        print('Set SEC_USER_AGENT, e.g. SEC_USER_AGENT="Your Name your@email"', file=sys.stderr)
        sys.exit(1)
    session = requests.Session()
    session.headers["User-Agent"] = user_agent
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    sectors = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "sector"]).set_index("ticker")["sector"]
    ghgrp = pd.read_csv(GHGRP_PATH)
    base = ghgrp[ghgrp["year"] == BASE_YEAR].groupby("ticker")[SCOPE1_CATEGORIES].sum()
    latest = ghgrp[ghgrp["year"] == LATEST_YEAR].groupby("ticker")[SCOPE1_CATEGORIES].sum()
    revenue_ttm = pd.read_csv(FINANCIALS_PATH, usecols=["ticker", "revenue_ttm"]).set_index("ticker")["revenue_ttm"]
    mac_mid = pd.read_csv(MAC_PATH).set_index("category")["mid"]

    tickers_json = session.get(TICKERS_URL, timeout=60).json()
    ciks = {normalise_ticker(v["ticker"]): int(v["cik_str"]) for v in tickers_json.values()}

    rows = []
    both_years = sorted(set(base.index) & set(latest.index) & set(sectors.index))
    for i, ticker in enumerate(both_years, start=1):
        row = {
            "ticker": ticker,
            "sector": sectors[ticker],
            "tbr_2019": None,
            "intensity_2019": None,
            "intensity_latest": None,
            "intensity_change": None,
        }
        try:
            cik = ciks.get(normalise_ticker(ticker))
            facts = load_facts(session, cik) if cik else None
            revenue_2019 = validation.annual_value(facts, validation.REVENUE_TAGS, BASE_YEAR) if facts else None
            ebitda_2019 = validation.ebitda(facts, BASE_YEAR) if facts else None

            emissions_2019 = float(base.loc[ticker, SCOPE1_CATEGORIES].sum())
            bill_2019 = sum(float(base.loc[ticker, c]) * max(float(mac_mid[c]), 0.0) for c in SCOPE1_CATEGORIES)
            if ebitda_2019 is not None and ebitda_2019 > 0:
                row["tbr_2019"] = bill_2019 / ebitda_2019

            latest_revenue = revenue_ttm.get(ticker)
            latest_revenue = None if latest_revenue is None or pd.isna(latest_revenue) else float(latest_revenue)
            row["intensity_2019"] = validation.intensity(emissions_2019, revenue_2019)
            row["intensity_latest"] = validation.intensity(float(latest.loc[ticker, SCOPE1_CATEGORIES].sum()), latest_revenue)
            row["intensity_change"] = validation.intensity_change(row["intensity_2019"], row["intensity_latest"])
        except Exception as exc:  # noqa: BLE001 -- one bad ticker must not kill the run
            print(f"{ticker}: {exc}", file=sys.stderr)
        rows.append(row)
        if i % 25 == 0 or i == len(both_years):
            print(f"[{i}/{len(both_years)}] {ticker}")

    df = pd.DataFrame(rows, columns=["ticker", "sector", "tbr_2019", "intensity_2019", "intensity_latest", "intensity_change"])
    assert df["ticker"].is_unique, "validation must have one row per ticker"
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    usable = df.dropna(subset=["tbr_2019", "intensity_change"])
    rho = usable["tbr_2019"].rank().corr(usable["intensity_change"].rank()) if len(usable) >= 3 else float("nan")
    print(f"Wrote {len(df)} rows to {OUT_PATH}; {len(usable)} usable; Spearman(tbr_2019, intensity_change) = {rho:.3f}")


if __name__ == "__main__":
    main()
