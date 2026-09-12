"""
Environmental variables via the Wikirate API: Scope 1 + 2 GHG emissions
(absolute + intensity per $ revenue), a renewable-energy proxy, and the
multi-year emissions trend.

Matching strategy: tickers are matched to Wikirate companies via SEC CIK
(from SEC's public company_tickers.json), not by company name -- name
matching on Wikirate is unreliable (exact-string lookups miss "Inc."/"Corp."
variants, and keyword search produces false positives).

Metric choice: the CDP-designer Scope 1/2 metrics on Wikirate stop at
2014-2019 for effectively every company (verified by inspection) and are not
usable as "current" data. The Global Reporting Initiative (GRI)-designer
versions of the same metrics are far more actively maintained (data through
2024-2025 for many companies) and are used here instead.

Output: data/out/environmental.csv -- exactly one row per ticker in the
universe, with nulls where a company has no CIK match on Wikirate or no
disclosed value for a given metric.
"""
import os
import time

import pandas as pd
import requests
import wikirate4py

UNIVERSE_PATH = "../out/universe.csv"
OUT_PATH = "../out/environmental.csv"
SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SEC_HEADERS = {"User-Agent": "hackathon-starter data pipeline efrem.sidiropoulos@gmail.com"}

DESIGNER = "Global Reporting Initiative"
METRIC_SCOPE1 = "Direct greenhouse gas (GHG) emissions (Scope 1), GRI 305-1-a (formerly G4-EN15-a)"
METRIC_SCOPE2 = "Indirect greenhouse gas (GHG) emissions (Scope 2), GRI 305-2 (formerly G4-EN16-a)"
METRIC_FUEL_RENEWABLE = "Fuel consumption from renewable sources, GRI 302-1-b (formerly G4-EN3-b)"
METRIC_FUEL_NONRENEWABLE = "Fuel consumption from non-renewable sources, GRI 302-1-a (formerly G4-EN3-a)"

TREND_YEARS = 5
SLEEP_SECONDS = 0.05
MIN_CALL_INTERVAL = 0.5
FETCH_RENEWABLE = False  # dropped from this pass to cut call volume ~40%; scope1/2 prioritized
_last_call_time = [0.0]


def throttled_call(fn, *args, **kwargs):
    """Paces calls to stay under Wikirate's rate limit, and retries once on a
    429 (recovery was ~7s in testing) instead of silently treating it as
    'no data' -- that silent-swallow bug is what caused the first run to
    falsely mark ~95% of tickers as unmatched."""
    wait = MIN_CALL_INTERVAL - (time.time() - _last_call_time[0])
    if wait > 0:
        time.sleep(wait)
    for attempt in range(3):
        try:
            result = fn(*args, **kwargs)
            _last_call_time[0] = time.time()
            return result
        except wikirate4py.exceptions.TooManyRequestsException:
            _last_call_time[0] = time.time()
            time.sleep(10 * (attempt + 1))
    raise RuntimeError("Wikirate rate limit not recovered after retries")


def to_float(value):
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def build_cik_map() -> dict:
    resp = requests.get(SEC_TICKERS_URL, headers=SEC_HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return {
        entry["ticker"].strip().upper(): str(entry["cik_str"]).zfill(10)
        for entry in data.values()
    }


def resolve_wikirate_id(api: wikirate4py.API, cik: str):
    results = throttled_call(api.get_companies, company_identifier=cik)
    return results[0].id if results else None


def latest_years_values(api: wikirate4py.API, company_id: int, metric_name: str, designer: str, limit: int):
    answers = throttled_call(
        api.get_answers, metric_name=metric_name, metric_designer=designer,
        company=company_id, limit=limit, sort_by="year", sort_dir="desc",
    )
    return [(a.year, to_float(a.value)) for a in answers if to_float(a.value) is not None]


def fetch_one(api: wikirate4py.API, ticker: str, cik: str | None) -> dict:
    row = {
        "ticker": ticker,
        "wikirate_matched": False,
        "scope1_year": None, "scope1_tco2e": None,
        "scope2_year": None, "scope2_tco2e": None,
        "scope1_2_total_tco2e": None,
        "renewable_fuel_pct": None,
        "renewable_fuel_pct_year": None,
        "emissions_trend_pct_change": None,
        "emissions_trend_years_used": None,
        "fetch_error": None,
    }
    if not cik:
        return row

    try:
        company_id = resolve_wikirate_id(api, cik)
    except Exception as exc:  # noqa: BLE001 -- record it, don't mistake it for "no match"
        row["fetch_error"] = f"resolve: {exc}"
        return row
    if company_id is None:
        return row
    row["wikirate_matched"] = True

    try:
        scope1 = latest_years_values(api, company_id, METRIC_SCOPE1, DESIGNER, TREND_YEARS)
        scope2 = latest_years_values(api, company_id, METRIC_SCOPE2, DESIGNER, TREND_YEARS)
        if FETCH_RENEWABLE:
            renewable = latest_years_values(api, company_id, METRIC_FUEL_RENEWABLE, DESIGNER, TREND_YEARS)
            nonrenewable = latest_years_values(api, company_id, METRIC_FUEL_NONRENEWABLE, DESIGNER, TREND_YEARS)
        else:
            renewable, nonrenewable = [], []
    except Exception as exc:  # noqa: BLE001
        row["fetch_error"] = f"answers: {exc}"
        return row

    if scope1:
        row["scope1_year"], row["scope1_tco2e"] = scope1[0]
    if scope2:
        row["scope2_year"], row["scope2_tco2e"] = scope2[0]
    if scope1 and scope2 and scope1[0][0] == scope2[0][0]:
        row["scope1_2_total_tco2e"] = scope1[0][1] + scope2[0][1]

    renewable_by_year = dict(renewable)
    nonrenewable_by_year = dict(nonrenewable)
    common_fuel_years = sorted(set(renewable_by_year) & set(nonrenewable_by_year), reverse=True)
    if common_fuel_years:
        latest_common_year = common_fuel_years[0]
        r_val, nr_val = renewable_by_year[latest_common_year], nonrenewable_by_year[latest_common_year]
        total_fuel = r_val + nr_val
        if total_fuel:
            row["renewable_fuel_pct"] = r_val / total_fuel
            row["renewable_fuel_pct_year"] = latest_common_year

    # Trend: oldest vs newest among the scope1+scope2 combined-year series available.
    combined = {}
    for year, val in scope1:
        combined.setdefault(year, {})["s1"] = val
    for year, val in scope2:
        combined.setdefault(year, {})["s2"] = val
    complete_years = sorted(y for y, parts in combined.items() if "s1" in parts and "s2" in parts)
    if len(complete_years) >= 2:
        oldest, newest = complete_years[0], complete_years[-1]
        oldest_total = combined[oldest]["s1"] + combined[oldest]["s2"]
        newest_total = combined[newest]["s1"] + combined[newest]["s2"]
        # Wikirate is crowd-sourced, and individual year entries occasionally
        # use inconsistent units (confirmed for MOS: 2020 was entered as
        # "3.44"/"1.48" while 2021 was "3230000"/"1300000" -- clearly missing
        # a million-tonne scale factor). A >=50x swing is not a real YoY
        # emissions change for any company; treat it as a source data error.
        if oldest_total and abs((newest_total - oldest_total) / oldest_total) < 50:
            row["emissions_trend_pct_change"] = (newest_total - oldest_total) / oldest_total
            row["emissions_trend_years_used"] = f"{oldest}-{newest}"

    return row


def main():
    universe = pd.read_csv(UNIVERSE_PATH)
    tickers = universe["ticker"].tolist()

    api_key = os.environ.get("WIKIRATE_API_KEY")
    if not api_key:
        print("WIKIRATE_API_KEY not set -- writing environmental.csv with all-null columns")
        df = pd.DataFrame({"ticker": tickers})
        for col in ["wikirate_matched", "scope1_year", "scope1_tco2e", "scope2_year", "scope2_tco2e",
                    "scope1_2_total_tco2e", "renewable_fuel_pct", "renewable_fuel_pct_year",
                    "emissions_trend_pct_change", "emissions_trend_years_used", "fetch_error"]:
            df[col] = None
        df.to_csv(OUT_PATH, index=False)
        return

    api = wikirate4py.API(api_key)
    cik_map = build_cik_map()

    rows = []
    for i, ticker in enumerate(tickers, start=1):
        cik = cik_map.get(ticker.replace("-", ".").upper()) or cik_map.get(ticker.upper())
        rows.append(fetch_one(api, ticker, cik))
        if i % 25 == 0 or i == len(tickers):
            print(f"[{i}/{len(tickers)}] {ticker}")
        time.sleep(SLEEP_SECONDS)

    df = pd.DataFrame(rows)
    assert df["ticker"].is_unique, "environmental must have exactly one row per ticker"
    missing = set(universe["ticker"]) - set(df["ticker"])
    assert not missing, f"missing tickers from environmental output: {missing}"

    df.to_csv(OUT_PATH, index=False)
    n_matched = df["wikirate_matched"].sum()
    n_scope12 = df["scope1_2_total_tco2e"].notna().sum()
    n_errors = df["fetch_error"].notna().sum()
    print(f"Wrote {len(df)} rows to {OUT_PATH} ({n_matched} matched, {n_scope12} with Scope1+2 data, {n_errors} fetch errors)")


if __name__ == "__main__":
    main()
