"""
Loads data/out/sp500_esg_financials_zscores.csv into the
public.sp500_esg_zscores table (see supabase/schema.sql) via a direct
Postgres connection (upsert on ticker, so it's safe to re-run).

Requires the table to already exist -- run the CREATE TABLE block in
supabase/schema.sql once via the SQL Editor first.

Use the "Session pooler" connection string from Supabase's connection
dialog, not "Direct connection" -- the direct host is IPv6-only, which many
networks can't reach.

Usage:
  PGHOST=... PGPORT=5432 PGUSER=postgres.<project-ref> PGPASSWORD=... PGDATABASE=postgres python 07_load_supabase.py

Note on nulls: do NOT use `df.where(pd.notna(df), None)` to prep values for
insertion -- numpy silently coerces None back to NaN when assigned into a
float64 column, so every "missing" value ends up stored as the literal float
NaN instead of SQL NULL (this bit us: it made count(column) report 100%
coverage on columns that were actually ~80% empty). Convert NaN to None
per-value, after the DataFrame has become plain Python objects (via
itertuples), not before.
"""
import math
import os
import sys

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

CSV_PATH = "../out/sp500_esg_financials_zscores.csv"
TABLE = "sp500_esg_zscores"
BATCH_SIZE = 100


def clean_value(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def main():
    required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"Set environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    cols = list(df.columns)
    rows = [
        tuple(clean_value(v) for v in row)
        for row in df.itertuples(index=False, name=None)
    ]

    conn = psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ["PGPORT"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"], connect_timeout=15,
    )
    cur = conn.cursor()

    col_list = ", ".join(cols)
    update_cols = [c for c in cols if c != "ticker"]
    update_clause = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
    sql = (
        f"insert into public.{TABLE} ({col_list}) values %s "
        f"on conflict (ticker) do update set {update_clause}"
    )

    n_batches = math.ceil(len(rows) / BATCH_SIZE)
    for i in range(n_batches):
        batch = rows[i * BATCH_SIZE:(i + 1) * BATCH_SIZE]
        execute_values(cur, sql, batch)
        print(f"Batch {i + 1}/{n_batches} upserted ({len(batch)} rows)")

    conn.commit()

    cur.execute(f"select count(*) from public.{TABLE};")
    print(f"Done: {cur.fetchone()[0]} rows in {TABLE}")
    conn.close()


if __name__ == "__main__":
    main()
