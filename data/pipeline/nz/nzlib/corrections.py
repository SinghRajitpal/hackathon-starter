"""Scope 1 corrections for verified unit/scope errors in the shared Wikirate/GRI data.

See maps/scope1_corrections.csv for the corrections table (ticker, year, original_tco2e,
corrected_tco2e, source_url, note) and docs/decisions-log.md for the rule and citations.
"""
import pandas as pd


def apply_scope1_corrections(
    universe_df: pd.DataFrame, corrections_df: pd.DataFrame
) -> tuple[pd.DataFrame, set[str]]:
    """Replace `scope1_tco2e` for tickers listed in `corrections_df`.

    `universe_df` is the raw sp500_esg_financials_raw.csv universe (one row per ticker).
    `corrections_df` has columns ticker, year, original_tco2e, corrected_tco2e, source_url, note.
    Returns (corrected copy of universe_df, set of tickers actually corrected). Callers are
    responsible for appending the 'scope1-corrected' flag for each returned ticker.
    """
    out = universe_df.copy()
    corrected_tickers: set[str] = set()
    if corrections_df.empty:
        return out, corrected_tickers
    by_ticker = corrections_df.set_index("ticker")["corrected_tco2e"].to_dict()
    for ticker, corrected_value in by_ticker.items():
        mask = out["ticker"] == ticker
        if mask.any():
            out.loc[mask, "scope1_tco2e"] = corrected_value
            corrected_tickers.add(ticker)
    return out, corrected_tickers
