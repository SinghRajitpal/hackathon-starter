"""
Supabase REST (PostgREST) loader helpers (spec P1 ruling): no PG* database password exists for this
project, only the service-role secret key, so 19_load_supabase.py writes over the REST API instead of
psycopg2. Keep this module free of network calls — callers pass in a `session` (e.g. requests.Session,
or a fake in tests) so everything here stays unit-testable.
"""
import json
import math
import os

BATCH_SIZE = 500
INTEGER_COLUMNS = {"emissions_year", "year", "fiscal_year"}


def env_config(env: dict | None = None) -> tuple[str, dict]:
    """Read SUPABASE_URL + SUPABASE_SECRET_KEY (env or `.env.local`, sourced by the caller).

    Returns (base_url with no trailing slash, headers with apikey + Bearer auth + JSON content type).
    """
    env = os.environ if env is None else env
    url = env.get("SUPABASE_URL")
    key = env.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError("Set SUPABASE_URL and SUPABASE_SECRET_KEY (env or .env.local)")
    return url.rstrip("/"), {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _clean_scalar(value):
    """None/NaN -> None; numpy/pandas scalars -> plain Python so json.dumps never sees them."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if hasattr(value, "item"):
        return _clean_scalar(value.item())
    return value


def _flags_to_list(value) -> list:
    """Pipe-joined flags string -> JSON list; empty/NaN/None -> []."""
    if value is None:
        return []
    if isinstance(value, float) and math.isnan(value):
        return []
    if isinstance(value, list):
        return [str(v) for v in value]
    text = str(value)
    return text.split("|") if text else []


def build_payload(records: list[dict], integer_columns: set[str] = INTEGER_COLUMNS) -> list[dict]:
    """Turn row dicts (e.g. `df.to_dict("records")`) into JSON-safe REST payload dicts.

    - `flags` (pipe-joined string, or already a list) -> JSON list, empty when missing/blank.
    - Columns in `integer_columns` -> Python `int` (None stays None; PostgREST rejects "2023.0").
    - Every other value: NaN/None -> null, numpy/pandas scalars -> plain Python.
    Raises if a row still isn't JSON-serialisable (fail fast rather than at request time).
    """
    payloads = []
    for record in records:
        row = {}
        for key, value in record.items():
            if key == "flags":
                row[key] = _flags_to_list(value)
                continue
            value = _clean_scalar(value)
            if key in integer_columns and value is not None:
                value = int(value)
            row[key] = value
        json.dumps(row)
        payloads.append(row)
    return payloads


def batched(rows: list, size: int = BATCH_SIZE):
    for i in range(0, len(rows), size):
        yield rows[i : i + size]


def upsert(session, base_url: str, headers: dict, table: str, rows: list[dict], keys: list[str]) -> int:
    """POST `rows` in batches of <= BATCH_SIZE with `on_conflict`=`keys`, merge-duplicates. Returns rows sent."""
    if not rows:
        return 0
    url = f"{base_url}/rest/v1/{table}?on_conflict={','.join(keys)}"
    post_headers = {**headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
    sent = 0
    for batch in batched(rows):
        response = session.post(url, headers=post_headers, json=batch)
        response.raise_for_status()
        sent += len(batch)
    return sent


def insert(session, base_url: str, headers: dict, table: str, rows: list[dict]) -> int:
    """Plain POST in batches (no on_conflict) — used for child tables right after `delete_all`."""
    if not rows:
        return 0
    url = f"{base_url}/rest/v1/{table}"
    post_headers = {**headers, "Prefer": "return=minimal"}
    sent = 0
    for batch in batched(rows):
        response = session.post(url, headers=post_headers, json=batch)
        response.raise_for_status()
        sent += len(batch)
    return sent


def delete_all(session, base_url: str, headers: dict, table: str, ticker_column: str = "ticker") -> None:
    """DELETE every row (`<ticker_column>=not.is.null`) — used before `insert` for child tables.

    Not part of a transaction: if the following insert fails, the table is left empty until rerun.
    """
    url = f"{base_url}/rest/v1/{table}?{ticker_column}=not.is.null"
    response = session.delete(url, headers=headers)
    response.raise_for_status()


def count(session, base_url: str, headers: dict, table: str, key_column: str) -> int:
    """Row count via `Content-Range` on a zero-row range request (no PG* needed for verification)."""
    url = f"{base_url}/rest/v1/{table}?select={key_column}"
    count_headers = {**headers, "Prefer": "count=exact", "Range": "0-0"}
    response = session.get(url, headers=count_headers)
    response.raise_for_status()
    content_range = response.headers.get("Content-Range", "*/0")
    return int(content_range.split("/")[-1])
