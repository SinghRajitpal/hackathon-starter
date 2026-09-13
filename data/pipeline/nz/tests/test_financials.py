import pandas as pd

from nzlib import financials


def quarterly(values_by_row: dict[str, list]) -> pd.DataFrame:
    cols = pd.to_datetime(["2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30", "2025-06-30"])
    return pd.DataFrame(values_by_row, index=cols).T


def test_ttm_sums_four_anchored_quarters_skipping_placeholder_column():
    df = quarterly({"Total Revenue": [None, 10, 11, 12, 13], "EBITDA": [5, 2, 2, 3, 3]})
    cols = financials.anchor_columns(df, "Total Revenue")
    assert financials.ttm_sum(df, "Total Revenue", cols) == 46
    assert financials.ttm_sum(df, "EBITDA", cols) == 10


def test_ttm_is_none_when_a_quarter_is_missing():
    df = quarterly({"Total Revenue": [1, 2, 3, None, None]})
    assert financials.ttm_sum(df, "Total Revenue", financials.anchor_columns(df, "Total Revenue")) is None


def test_float_cap_uses_ratio_and_falls_back_for_dual_class():
    assert financials.float_cap(100.0, 90, 100) == (90.0, None)
    assert financials.float_cap(700e9, 1_233_781, 1_408_035_161) == (700e9, "float-cap-fallback-market-cap")
    assert financials.float_cap(None, 1, 1) == (None, "no-market-cap")
