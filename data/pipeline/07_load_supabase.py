"""
Bulk-loads data/out/sp500_esg_financials_zscores.csv into the
public.sp500_esg_zscores table (see supabase/schema.sql) via the Supabase
REST API, using the service role key so RLS is bypassed for the write.

Requires the table to already exist (run the schema.sql block manually in
the Supabase SQL Editor first -- PostgREST doesn't support DDL).

Usage:
  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=sb_secret_... python 07_load_supabase.py
"""
import math
import os
import sys

import pandas as pd
import requests

CSV_PATH = "../out/sp500_esg_financials_zscores.csv"
TABLE = "sp500_esg_zscores"
BATCH_SIZE = 100


def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    records = df.where(pd.notna(df), None).to_dict(orient="records")

    endpoint = f"{url.rstrip('/')}/rest/v1/{TABLE}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    n_batches = math.ceil(len(records) / BATCH_SIZE)
    for i in range(n_batches):
        batch = records[i * BATCH_SIZE:(i + 1) * BATCH_SIZE]
        resp = requests.post(endpoint, headers=headers, json=batch, timeout=30)
        if resp.status_code not in (200, 201):
            print(f"Batch {i + 1}/{n_batches} failed: {resp.status_code} {resp.text[:300]}", file=sys.stderr)
            sys.exit(1)
        print(f"Batch {i + 1}/{n_batches} loaded ({len(batch)} rows)")

    print(f"Done: {len(records)} rows upserted into {TABLE}")


if __name__ == "__main__":
    main()
