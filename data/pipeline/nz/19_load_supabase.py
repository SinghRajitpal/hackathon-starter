"""
Loads the nz pipeline outputs into the nz_* Supabase tables (see supabase/schema.sql) over the
Supabase REST API (PostgREST), using the service-role secret key — this project has no PG* database
password (spec ruling, decisions-log). `nz_company_inputs`, `nz_mac_costs`, `nz_product_map` and
`nz_validation_2019` are upserted; `nz_emissions_sources` and `nz_segments` are child tables refreshed
by delete-then-insert, which is NOT one transaction: a mid-run failure can leave a child table empty
until rerun. Optional files (segments.csv, product maps, validation_2019.csv) are loaded when present.

This writes to the shared Supabase project — get sign-off before running outside a pre-approved batch.

Usage:
  set -a; source ../../../.env.local; set +a; uv run python 19_load_supabase.py
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

from nzlib.supabase_rest import build_payload, count, delete_all, env_config, insert, upsert

OUT_DIR = Path("../../out/nz")
MAPS_DIR = Path("maps")

COMPANY_COLUMNS = [
    "ticker", "company_name", "sector", "sub_industry", "e_scope2", "e_combustion", "e_fleet", "e_process",
    "e_fugitive", "emissions_year", "revenue_ttm", "ebitda_ttm", "fcf_ttm", "net_debt", "de", "ben",
    "de_ben_status", "fossil_generation_share", "renewable_generation_share", "price", "shares_outstanding",
    "float_cap", "flags",
]
SOURCE_COLUMNS = ["ticker", "source", "category", "tco2e", "year", "reference"]
MAC_COLUMNS = ["category", "low", "mid", "high", "source", "source_date"]
SEGMENT_COLUMNS = ["ticker", "segment", "revenue", "share", "class", "fiscal_year", "filing_url", "method"]
VALIDATION_COLUMNS = ["ticker", "sector", "tbr_2019", "intensity_2019", "intensity_latest", "intensity_change"]


def load_csv(path: Path, columns: list[str]) -> pd.DataFrame | None:
    if not path.exists():
        print(f"  {path} not found, skipped")
        return None
    return pd.read_csv(path)[columns]


def load_upsert(
    session, base_url, headers, path: Path, columns: list[str], table: str, keys: list[str], stamp_updated_at: bool = False
) -> None:
    df = load_csv(path, columns)
    if df is None:
        return
    records = df.to_dict("records")
    if stamp_updated_at:
        now = datetime.now(timezone.utc).isoformat()
        for record in records:
            record["updated_at"] = now
    sent = upsert(session, base_url, headers, table, build_payload(records), keys)
    print(f"  {table}: {sent} rows sent")


def load_child(session, base_url, headers, path: Path, columns: list[str], table: str) -> None:
    df = load_csv(path, columns)
    if df is None:
        return
    delete_all(session, base_url, headers, table)
    sent = insert(session, base_url, headers, table, build_payload(df.to_dict("records")))
    print(f"  {table}: {sent} rows sent")


def load_product_maps(session, base_url, headers) -> None:
    frames = []
    for list_name in ["exposed", "beneficiary"]:
        df = load_csv(MAPS_DIR / f"{list_name}_products.csv", ["product_line", "source"])
        if df is None:
            continue
        df = df.copy()
        df.insert(0, "list", list_name)
        frames.append(df)
    if not frames:
        return
    products = pd.concat(frames, ignore_index=True)
    sent = upsert(session, base_url, headers, "nz_product_map", build_payload(products.to_dict("records")), ["list", "product_line"])
    print(f"  nz_product_map: {sent} rows sent")


def main():
    try:
        base_url, headers = env_config()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    session = requests.Session()

    load_upsert(
        session, base_url, headers, OUT_DIR / "company_inputs.csv", COMPANY_COLUMNS, "nz_company_inputs", ["ticker"],
        stamp_updated_at=True,
    )
    load_child(session, base_url, headers, OUT_DIR / "emissions_sources.csv", SOURCE_COLUMNS, "nz_emissions_sources")
    load_upsert(session, base_url, headers, MAPS_DIR / "mac_costs.csv", MAC_COLUMNS, "nz_mac_costs", ["category"])
    load_child(session, base_url, headers, OUT_DIR / "segments.csv", SEGMENT_COLUMNS, "nz_segments")
    load_product_maps(session, base_url, headers)
    load_upsert(session, base_url, headers, OUT_DIR / "validation_2019.csv", VALIDATION_COLUMNS, "nz_validation_2019", ["ticker"])

    for table, key in [
        ("nz_company_inputs", "ticker"),
        ("nz_emissions_sources", "ticker"),
        ("nz_mac_costs", "category"),
        ("nz_validation_2019", "ticker"),
    ]:
        print(f"{table}: {count(session, base_url, headers, table, key)} rows")


if __name__ == "__main__":
    main()
