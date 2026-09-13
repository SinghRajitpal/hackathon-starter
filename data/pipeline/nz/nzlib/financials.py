"""Trailing-twelve-month figures and float-adjusted market cap (spec D8, D16)."""
import math

import pandas as pd

# D16: below this float/outstanding ratio the float figure is treated as broken (BRK-B dual class).
MIN_FLOAT_RATIO = 0.5


def anchor_columns(df: pd.DataFrame | None, anchor_row: str, n: int = 4) -> list:
    """Newest-first columns where `anchor_row` is populated (Yahoo posts placeholder columns)."""
    if df is None or df.empty or anchor_row not in df.index:
        return []
    ordered_columns = sorted(df.columns, reverse=True)
    return [col for col in ordered_columns if pd.notna(df.loc[anchor_row, col])][:n]


def ttm_sum(df: pd.DataFrame | None, row: str, columns: list) -> float | None:
    """Sum of the four given quarters; None unless all four are present."""
    if df is None or row not in df.index or len(columns) < 4:
        return None
    values = [df.loc[row, col] for col in columns[:4]]
    if any(pd.isna(v) for v in values):
        return None
    return float(sum(values))


def cap_at_listed_line(cap, flag, price, shares_outstanding) -> tuple[float | None, str | None]:
    """Cap `cap` at price x shares_outstanding for this listed line.

    D16 fix: yfinance `marketCap` is company-wide, but the pipeline pairs it with a per-class
    share count. For multi-class tickers (GOOGL/GOOG, FOX/FOXA, NWS/NWSA, BRK-B) and several
    others (IBKR, TKO, DELL, BX, ...) this can overstate the cap by 1.2x-4x. The listed line's
    own price x shares_outstanding is always a valid upper bound and needs no refetch, so this
    also drives the CSV `--recap-only` path. Idempotent by construction: a flag that already
    records the cap short-circuits before recomputing, so repeated `--recap-only` runs cannot
    drift or double-append -- price/shares_outstanding read back from a CSV round-trip are not
    guaranteed bit-identical to the values used the first time (pandas' float serialisation),
    which could otherwise flip the `<` comparison by a part in 1e15 and re-append the flag.
    """
    if cap is None or pd.isna(cap):
        return cap, flag
    if flag and "capped-listed-line" in flag:
        return cap, flag
    if price is None or pd.isna(price) or price <= 0:
        return cap, flag
    if shares_outstanding is None or pd.isna(shares_outstanding) or shares_outstanding <= 0:
        return cap, flag
    listed_line = float(price) * float(shares_outstanding)
    if listed_line < cap:
        new_flag = "float-cap-capped-listed-line" if not flag else f"{flag}+capped-listed-line"
        return listed_line, new_flag
    return cap, flag


def float_cap(market_cap, float_shares, shares_outstanding, price=None) -> tuple[float | None, str | None]:
    """Return (float-adjusted cap, flag). Falls back to market cap when the float ratio is
    unusable, then capped at the listed line when `price` is given (see `cap_at_listed_line`)."""
    if market_cap is None or pd.isna(market_cap) or market_cap <= 0:
        return None, "no-market-cap"
    if (
        pd.isna(float_shares)
        or pd.isna(shares_outstanding)
        or float_shares <= 0
        or shares_outstanding <= 0
    ):
        cap, flag = float(market_cap), "float-cap-fallback-market-cap"
    else:
        ratio = float_shares / shares_outstanding
        if not math.isfinite(ratio) or ratio < MIN_FLOAT_RATIO or ratio > 1.0:
            cap, flag = float(market_cap), "float-cap-fallback-market-cap"
        else:
            cap, flag = float(market_cap) * ratio, None
    return cap_at_listed_line(cap, flag, price, shares_outstanding)
