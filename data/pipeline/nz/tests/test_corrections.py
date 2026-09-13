"""Scope 1 corrections for verified unit/scope errors in the shared Wikirate/GRI data (decisions-log)."""
import pandas as pd
import pytest

from nzlib.corrections import apply_scope1_corrections


def _universe(rows):
    return pd.DataFrame(rows)


def _corrections(rows):
    return pd.DataFrame(rows)


def test_replaces_scope1_tco2e_for_corrected_ticker():
    universe = _universe(
        [
            {"ticker": "CSCO", "scope1_tco2e": 23000000.0, "scope1_source": "Wikirate/GRI"},
            {"ticker": "AAPL", "scope1_tco2e": 55200.0, "scope1_source": "Wikirate/GRI"},
        ]
    )
    corrections = _corrections(
        [
            {
                "ticker": "CSCO",
                "year": 2021,
                "original_tco2e": 23000000.0,
                "corrected_tco2e": 34931.0,
                "source_url": "https://example.com/cisco",
                "note": "wrong scope",
            }
        ]
    )

    out, corrected = apply_scope1_corrections(universe, corrections)

    assert out.loc[out["ticker"] == "CSCO", "scope1_tco2e"].item() == pytest.approx(34931.0)
    assert corrected == {"CSCO"}


def test_leaves_uncorrected_tickers_untouched():
    universe = _universe(
        [
            {"ticker": "CSCO", "scope1_tco2e": 23000000.0, "scope1_source": "Wikirate/GRI"},
            {"ticker": "AAPL", "scope1_tco2e": 55200.0, "scope1_source": "Wikirate/GRI"},
        ]
    )
    corrections = _corrections(
        [
            {
                "ticker": "CSCO",
                "year": 2021,
                "original_tco2e": 23000000.0,
                "corrected_tco2e": 34931.0,
                "source_url": "https://example.com/cisco",
                "note": "wrong scope",
            }
        ]
    )

    out, corrected = apply_scope1_corrections(universe, corrections)

    assert out.loc[out["ticker"] == "AAPL", "scope1_tco2e"].item() == pytest.approx(55200.0)
    assert "AAPL" not in corrected


def test_ticker_not_present_in_universe_is_ignored():
    universe = _universe([{"ticker": "AAPL", "scope1_tco2e": 55200.0, "scope1_source": "Wikirate/GRI"}])
    corrections = _corrections(
        [
            {
                "ticker": "NOTREAL",
                "year": 2020,
                "original_tco2e": 1.0,
                "corrected_tco2e": 2.0,
                "source_url": "https://example.com/notreal",
                "note": "n/a",
            }
        ]
    )

    out, corrected = apply_scope1_corrections(universe, corrections)

    assert out["scope1_tco2e"].tolist() == [55200.0]
    assert corrected == set()


def test_does_not_mutate_the_input_frame():
    universe = _universe([{"ticker": "CSCO", "scope1_tco2e": 23000000.0, "scope1_source": "Wikirate/GRI"}])
    corrections = _corrections(
        [
            {
                "ticker": "CSCO",
                "year": 2021,
                "original_tco2e": 23000000.0,
                "corrected_tco2e": 34931.0,
                "source_url": "https://example.com/cisco",
                "note": "wrong scope",
            }
        ]
    )

    apply_scope1_corrections(universe, corrections)

    assert universe.loc[0, "scope1_tco2e"] == pytest.approx(23000000.0)


def test_empty_corrections_returns_unchanged_universe_and_empty_set():
    universe = _universe([{"ticker": "AAPL", "scope1_tco2e": 55200.0, "scope1_source": "Wikirate/GRI"}])
    corrections = _corrections([])

    out, corrected = apply_scope1_corrections(universe, corrections)

    assert out["scope1_tco2e"].tolist() == [55200.0]
    assert corrected == set()
