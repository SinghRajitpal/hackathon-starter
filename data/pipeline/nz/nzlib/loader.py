"""Postgres upsert helpers, following 07_load_supabase.py (NaN → NULL per value, after itertuples)."""
import math


def clean_value(value):
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def upsert_sql(table: str, columns: list[str], key_columns: list[str]) -> str:
    updates = [c for c in columns if c not in key_columns]
    conflict = ", ".join(key_columns)
    action = "do nothing" if not updates else "do update set " + ", ".join(f"{c} = excluded.{c}" for c in updates)
    return f"insert into public.{table} ({', '.join(columns)}) values %s on conflict ({conflict}) {action}"


def rows_for_insert(df) -> list[tuple]:
    return [tuple(clean_value(v) for v in row) for row in df.itertuples(index=False, name=None)]
