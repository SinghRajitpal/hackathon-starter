"""
Climate TRACE v7 non-US asset emissions per ticker (spec D10, D13).

Two modes:
  uv run python 12_climate_trace.py --suggest
      Searches /v7/owners by company name for the six candidate sectors and writes
      maps/ct_owner_candidates.csv for a human to review. Copy reviewed rows into
      maps/ct_owner_map.csv (columns: ticker,owner_ids,checked_by,note; owner_ids pipe-joined).
  uv run python 12_climate_trace.py
      For every ticker in maps/ct_owner_map.csv: list the owner's sources for YEAR, keep non-US
      sources in mapped subsectors, confirm the company in each source's own owner list, split
      emissions equally across distinct owners.

Requests are throttled (>= 0.2s apart) and JSON responses are cached under
../../raw/nz/climate_trace/, so reruns cost no further API calls.

Output: ../../out/nz/ct_categories.csv -- one row per mapped ticker.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path

import pandas as pd
import requests

from nzlib.climate_trace import (
    BASIN_AGGREGATE_SUBSECTORS,
    SUBSECTOR_CATEGORY,
    US_COUNTRY_CODES,
    aggregate,
    attribute,
    is_basin_aggregate,
)
from nzlib.ghgrp import normalize_name

API = "https://api.climatetrace.org/v7"
YEAR = 2024
GAS = "co2e_100yr"
PAGE_SIZE = 100
CANDIDATE_SECTORS = ["Energy", "Utilities", "Materials", "Industrials", "Consumer Discretionary", "Consumer Staples"]
UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
OWNER_MAP_PATH = Path("maps/ct_owner_map.csv")
CANDIDATES_PATH = Path("maps/ct_owner_candidates.csv")
OUT_PATH = Path("../../out/nz/ct_categories.csv")
CACHE_DIR = Path("../../raw/nz/climate_trace")
THROTTLE_SECONDS = 0.2

_last_request_time = [0.0]


def _throttle() -> None:
    wait = THROTTLE_SECONDS - (time.monotonic() - _last_request_time[0])
    if wait > 0:
        time.sleep(wait)
    _last_request_time[0] = time.monotonic()


def _cache_path(path: str, params: dict) -> Path:
    key = hashlib.sha256(json.dumps({"path": path, "params": params}, sort_keys=True, default=str).encode()).hexdigest()
    return CACHE_DIR / f"{key}.json"


def api_get(session: requests.Session, path: str, **params):
    """GET with retries on 429/5xx, a JSON response cache, and a throttle between live requests.
    A 404 means 'nothing found' and returns None (cached as such so reruns cost 0 calls)."""
    cache_file = _cache_path(path, params)
    if cache_file.exists():
        return json.loads(cache_file.read_text())["data"]
    for attempt in range(4):
        _throttle()
        response = session.get(f"{API}{path}", params=params, timeout=60)
        if response.status_code == 404:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            cache_file.write_text(json.dumps({"data": None}))
            return None
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(5 * 2**attempt)
            continue
        response.raise_for_status()
        data = response.json()
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps({"data": data}))
        return data
    raise RuntimeError(f"Climate TRACE kept failing for {path} {params}")


def search_owners(session: requests.Session, company_name: str) -> list[dict]:
    """Search /v7/owners by name. If the raw name 404s or returns nothing, retry with the
    normalised name (title-cased) and then just its first word (controller ruling: real names
    like 'Chevron Corporation' 404 while 'Chevron Corp'/'Chevron' resolve)."""
    owners = api_get(session, "/owners", name=company_name, limit=10) or []
    if owners:
        return owners
    normalised = normalize_name(company_name).title()
    if normalised and normalised != company_name:
        owners = api_get(session, "/owners", name=normalised, limit=10) or []
        if owners:
            return owners
    first_word = normalised.split(" ")[0] if normalised else ""
    if first_word:
        owners = api_get(session, "/owners", name=first_word, limit=10) or []
    return owners


def suggest(session: requests.Session) -> None:
    universe = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "company_name", "sector"])
    rows = []
    for c in universe[universe["sector"].isin(CANDIDATE_SECTORS)].itertuples():
        owners = search_owners(session, c.company_name)
        exact = [o for o in owners if normalize_name(o["name"]) == normalize_name(c.company_name)]
        rows.append(
            {
                "ticker": c.ticker,
                "company_name": c.company_name,
                "candidate_ids": "|".join(o["id"] for o in owners),
                "candidate_names": "|".join(o["name"] for o in owners),
                "suggested_owner_ids": "|".join(o["id"] for o in exact),
            }
        )
    CANDIDATES_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(CANDIDATES_PATH, index=False)
    print(f"Wrote {len(rows)} candidates to {CANDIDATES_PATH}. Review, then copy accepted rows into {OWNER_MAP_PATH}.")


def sources_for_owner(session: requests.Session, owner_id: str) -> list[dict]:
    out, offset = [], 0
    while True:
        page = api_get(session, "/sources", ownerIds=owner_id, year=YEAR, gas=GAS, limit=PAGE_SIZE, offset=offset) or []
        rows = page if isinstance(page, list) else page.get("sources", [])
        out.extend(rows)
        if len(rows) < PAGE_SIZE:
            return out
        offset += PAGE_SIZE


def compute(session: requests.Session) -> None:
    owner_map = pd.read_csv(OWNER_MAP_PATH, dtype=str).fillna("")
    results = []
    excluded_ids: set[str] = set()
    excluded_tonnage = 0.0
    for entry in owner_map.itertuples():
        owner_ids = {i for i in entry.owner_ids.split("|") if i}
        if not owner_ids:
            continue
        seen, attributions = set(), []
        ticker_lost_a_source = False
        for owner_id in sorted(owner_ids):
            for source in sources_for_owner(session, owner_id):
                if source["id"] in seen:
                    continue
                seen.add(source["id"])
                if source.get("country") in US_COUNTRY_CODES or source.get("subsector") not in SUBSECTOR_CATEGORY:
                    continue
                # Country-basin aggregates (e.g. "Qatar_Rub al Khali_LNG") are not a single verified
                # owned asset -- spec D13's equal split assumes the latter -- so exclude them before
                # spending an API call confirming ownership.
                if source.get("subsector") in BASIN_AGGREGATE_SUBSECTORS and is_basin_aggregate(source.get("name")):
                    ticker_lost_a_source = True
                    if source["id"] not in excluded_ids:
                        excluded_ids.add(source["id"])
                        excluded_tonnage += float(source.get("emissionsQuantity") or 0.0)
                    continue
                detail = api_get(session, f"/sources/{source['id']}", gas=GAS, start=YEAR, end=YEAR) or {}
                attributions.append(attribute(source, detail.get("owners", []), owner_ids))
        totals = aggregate(attributions)
        results.append(
            {
                "ticker": entry.ticker,
                "year": YEAR,
                "assets_counted": sum(a is not None for a in attributions),
                **{c: totals.get(c) for c in ["combustion", "fleet", "process", "fugitive"]},
                "flags": "ct-basin-aggregate-excluded" if ticker_lost_a_source else "",
            }
        )
        print(f"{entry.ticker}: {results[-1]['assets_counted']} verified non-US assets")
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(results).to_csv(OUT_PATH, index=False)
    print(f"Wrote {len(results)} rows to {OUT_PATH}")
    print(f"Basin aggregates excluded: {len(excluded_ids)} sources, {excluded_tonnage / 1e6:.2f} Mt")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--suggest", action="store_true", help="write owner candidates for review")
    args = parser.parse_args()
    session = requests.Session()
    session.headers["User-Agent"] = "hackathon-starter nz pipeline"
    if args.suggest:
        suggest(session)
    else:
        compute(session)


if __name__ == "__main__":
    main()
