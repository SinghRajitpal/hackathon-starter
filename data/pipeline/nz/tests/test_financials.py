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


def test_anchor_columns_sorts_newest_first_when_columns_are_shuffled():
    # Columns intentionally out of chronological order in the frame's own layout.
    dates = pd.to_datetime(["2025-06-30", "2026-06-30", "2025-12-31", "2025-09-30", "2026-03-31"])
    df = pd.DataFrame({"Total Revenue": [100, 1, 2, 3, 4]}, index=dates).T
    cols = financials.anchor_columns(df, "Total Revenue")
    expected_cols = list(pd.to_datetime(["2026-06-30", "2026-03-31", "2025-12-31", "2025-09-30"]))
    assert list(cols) == expected_cols
    # True trailing four (1 + 4 + 2 + 3), not the frame's positional first four (100 + 1 + 2 + 3 = 106).
    assert financials.ttm_sum(df, "Total Revenue", cols) == 10


def test_float_cap_falls_back_when_float_shares_is_nan():
    assert financials.float_cap(100.0, float("nan"), 100) == (100.0, "float-cap-fallback-market-cap")


def test_float_cap_falls_back_when_shares_outstanding_is_nan():
    assert financials.float_cap(100.0, 90, float("nan")) == (100.0, "float-cap-fallback-market-cap")


def test_float_cap_falls_back_for_degenerate_inputs():
    assert financials.float_cap(100.0, 0, 100) == (100.0, "float-cap-fallback-market-cap")
    assert financials.float_cap(100.0, 90, None) == (100.0, "float-cap-fallback-market-cap")
    assert financials.float_cap(100.0, 120, 100) == (100.0, "float-cap-fallback-market-cap")
