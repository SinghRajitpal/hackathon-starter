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


def test_float_cap_is_capped_at_the_listed_line_for_multiclass_shares():
    # GOOGL-like: Alphabet's whole-company marketCap (~4.1T) is company-wide, but yfinance pairs
    # it with GOOGL's own float/shares-outstanding, which are near-equal (ratio path, not the
    # fallback). Without the D16 fix this overstates GOOGL's cap by ~4x its own listed line.
    market_cap = 4.1e12
    float_shares = 5.8e9
    shares_outstanding = 5.9e9
    price = 165.0
    listed_line = price * shares_outstanding
    assert financials.float_cap(market_cap, float_shares, shares_outstanding, price=price) == (
        listed_line,
        "float-cap-capped-listed-line",
    )


def test_float_cap_listed_line_cap_combines_with_an_existing_fallback_flag():
    # BRK-B-like: ratio fails (fallback to market cap), and the fallback market cap still needs
    # capping at BRK-B's own listed line.
    market_cap = 1.05e12
    price = 480.0
    shares_outstanding = 1.3e9  # BRK-B class B share count only
    listed_line = price * shares_outstanding
    assert financials.float_cap(market_cap, float("nan"), shares_outstanding, price=price) == (
        listed_line,
        "float-cap-fallback-market-cap+capped-listed-line",
    )


def test_float_cap_is_unchanged_when_listed_line_is_not_binding():
    # Single-class company: price x shares_outstanding is at or above the ratio-based cap, so
    # nothing should change.
    assert financials.float_cap(100.0, 90, 100, price=1.5) == (90.0, None)


def test_float_cap_without_price_keeps_old_behaviour():
    # price is optional (existing callers / existing cached data), so omitting it must not
    # change any pre-fix result.
    assert financials.float_cap(100.0, 90, 100) == (90.0, None)


def test_cap_at_listed_line_is_idempotent():
    cap, flag = financials.cap_at_listed_line(1000.0, None, price=2.0, shares_outstanding=100.0)
    assert (cap, flag) == (200.0, "float-cap-capped-listed-line")
    # Re-applying to the already-capped value must not change it or double-append the flag.
    assert financials.cap_at_listed_line(cap, flag, price=2.0, shares_outstanding=100.0) == (cap, flag)


def test_cap_at_listed_line_short_circuits_once_already_flagged():
    # Regression: a CSV round-trip (write, then read back for --recap-only) is not guaranteed to
    # reproduce the exact same float64 for price x shares_outstanding, which could otherwise flip
    # the strict `<` comparison by ~1e-15 relative and re-append "+capped-listed-line". Once the
    # flag already records the cap, recomputation must not happen at all.
    cap = 24016923577.760002
    flag = "float-cap-capped-listed-line"
    slightly_different_listed_line_inputs = (97.12, 247291223.0)  # would recompute to ...577.76
    assert financials.cap_at_listed_line(cap, flag, *slightly_different_listed_line_inputs) == (cap, flag)


def test_cap_at_listed_line_is_a_noop_without_price_or_shares():
    assert financials.cap_at_listed_line(1000.0, None, price=None, shares_outstanding=100.0) == (1000.0, None)
    assert financials.cap_at_listed_line(1000.0, None, price=2.0, shares_outstanding=None) == (1000.0, None)
    assert financials.cap_at_listed_line(None, "no-market-cap", price=2.0, shares_outstanding=100.0) == (
        None,
        "no-market-cap",
    )
