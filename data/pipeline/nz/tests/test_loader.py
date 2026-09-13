import pandas as pd

from nzlib import loader


def test_upsert_sql_updates_non_key_columns():
    assert loader.upsert_sql("t", ["ticker", "a"], ["ticker"]) == (
        "insert into public.t (ticker, a) values %s on conflict (ticker) do update set a = excluded.a"
    )


def test_upsert_sql_with_only_key_columns_does_nothing_on_conflict():
    assert loader.upsert_sql("t", ["ticker"], ["ticker"]) == (
        "insert into public.t (ticker) values %s on conflict (ticker) do nothing"
    )


def test_rows_for_insert_turns_nan_into_null():
    df = pd.DataFrame({"ticker": ["A"], "a": [float("nan")]})
    assert loader.rows_for_insert(df) == [("A", None)]
