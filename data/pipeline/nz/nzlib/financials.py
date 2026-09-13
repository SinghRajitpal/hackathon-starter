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


def float_cap(market_cap, float_shares, shares_outstanding) -> tuple[float | None, str | None]:
    """Return (float-adjusted cap, flag). Falls back to market cap when the float ratio is unusable."""
    if market_cap is None or pd.isna(market_cap) or market_cap <= 0:
        return None, "no-market-cap"
    if (
        pd.isna(float_shares)
        or pd.isna(shares_outstanding)
        or float_shares <= 0
        or shares_outstanding <= 0
    ):
        return float(market_cap), "float-cap-fallback-market-cap"
    ratio = float_shares / shares_outstanding
    if not math.isfinite(ratio) or ratio < MIN_FLOAT_RATIO or ratio > 1.0:
        return float(market_cap), "float-cap-fallback-market-cap"
    return float(market_cap) * ratio, None
