"""
Loads data/out/sp500_esg_correlation.csv (7x7 wide matrix, output of
09_score.py) into the public.sp500_esg_correlation table (see
supabase/schema.sql) via a direct Postgres connection, reshaped to one
row per (variable_a, variable_b) pair. Safe to re-run (upsert).

Usage:
  PGHOST=... PGPORT=5432 PGUSER=postgres.<project-ref> PGPASSWORD=... PGDATABASE=postgres python 11_load_correlation.py
"""
import os
import sys

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

CSV_PATH = "../out/sp500_esg_correlation.csv"
TABLE = "sp500_esg_correlation"


def main():
    required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"Set environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    wide = pd.read_csv(CSV_PATH, index_col=0)
    long = wide.reset_index(names="variable_a").melt(
        id_vars="variable_a", var_name="variable_b", value_name="r"
    )
    rows = list(long.itertuples(index=False, name=None))

    conn = psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ["PGPORT"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"], connect_timeout=15,
    )
    cur = conn.cursor()

    sql = (
        f"insert into public.{TABLE} (variable_a, variable_b, r) values %s "
        f"on conflict (variable_a, variable_b) do update set r = excluded.r"
    )
    execute_values(cur, sql, rows)
    conn.commit()

    cur.execute(f"select count(*) from public.{TABLE};")
    print(f"Done: {cur.fetchone()[0]} rows in {TABLE}")
    conn.close()


if __name__ == "__main__":
    main()
