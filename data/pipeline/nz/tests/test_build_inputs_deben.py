"""DE/BEN wiring in 17_build_inputs.py (P4): apply_de_ben() merges classified segments and
generation mix into the emissions inputs frame and writes segments.csv for nz_segments."""
import importlib.util
from pathlib import Path

import pandas as pd
import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "17_build_inputs.py"


def load_module(out_dir: Path):
    spec = importlib.util.spec_from_file_location("build_inputs_deben_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUT_DIR = out_dir
    module.CLASSIFIED_PATH = out_dir / "segments_classified.csv"
    module.MIX_PATH = out_dir / "generation_mix.csv"
    module.SEGMENTS_OUT_PATH = out_dir / "segments.csv"
    return module


def base_row(ticker, sector):
    return {
        "ticker": ticker,
        "company_name": ticker,
        "sector": sector,
        "sub_industry": "x",
        "e_scope2": None,
        "e_combustion": None,
        "e_fleet": None,
        "e_process": None,
        "e_fugitive": None,
        "emissions_year": None,
        "revenue_ttm": None,
        "ebitda_ttm": None,
        "fcf_ttm": None,
        "net_debt": None,
        "de": None,
        "ben": None,
        "de_ben_status": "unclassified",
        "fossil_generation_share": None,
        "renewable_generation_share": None,
        "price": None,
        "shares_outstanding": None,
        "float_cap": None,
        "flags": [],
    }


def test_apply_de_ben_tags_measures_out_of_scope_and_imputes(tmp_path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    inputs = pd.DataFrame(
        [
            base_row("F", "Consumer Discretionary"),
            base_row("XOM", "Energy"),
            base_row("AAPL", "Information Technology"),
        ]
    )

    pd.DataFrame(
        [
            {"ticker": "F", "member": "FordBlue", "revenue": 8e10, "method": "xbrl", "fiscal_year": 2025,
             "filing_url": "u", "label": "exposed", "reason": "ICE vehicles", "flag": None},
            {"ticker": "F", "member": "FordCredit", "revenue": 2e10, "method": "xbrl", "fiscal_year": 2025,
             "filing_url": "u", "label": "neutral", "reason": "financing", "flag": None},
            {"ticker": "XOM", "member": "Upstream", "revenue": 1e11, "method": "xbrl", "fiscal_year": 2025,
             "filing_url": "u", "label": "exposed", "reason": "crude oil", "flag": None},
        ]
    ).to_csv(out_dir / "segments_classified.csv", index=False)
    pd.DataFrame(columns=["ticker", "status", "fossil_share", "renewable_share", "nuclear_share", "basis", "quote"]).to_csv(
        out_dir / "generation_mix.csv", index=False
    )

    module = load_module(out_dir)
    result = module.apply_de_ben(inputs)
    by_ticker = result.set_index("ticker")

    assert by_ticker.at["F", "de"] == pytest.approx(0.8)
    assert by_ticker.at["F", "de_ben_status"] == "tagged"
    assert by_ticker.at["XOM", "de"] == pytest.approx(1.0)
    # AAPL has no segments and is out of the candidate sectors -> zeroed, not imputed
    assert (by_ticker.at["AAPL", "de"], by_ticker.at["AAPL", "ben"]) == (0.0, 0.0)
    assert by_ticker.at["AAPL", "de_ben_status"] == "unclassified"
    assert "de-ben-out-of-scope-zero" in by_ticker.at["AAPL", "flags"]

    segments = pd.read_csv(out_dir / "segments.csv")
    assert set(segments["ticker"]) == {"F", "XOM"}
    assert {"ticker", "segment", "revenue", "share", "class", "fiscal_year", "filing_url", "method"} <= set(segments.columns)


def test_apply_de_ben_imputes_in_scope_company_with_no_segments(tmp_path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    inputs = pd.DataFrame(
        [
            base_row("XOM", "Energy"),
            base_row("NOSEG", "Energy"),
        ]
    )
    pd.DataFrame(
        [
            {"ticker": "XOM", "member": "Upstream", "revenue": 1e11, "method": "xbrl", "fiscal_year": 2025,
             "filing_url": "u", "label": "exposed", "reason": "crude oil", "flag": None},
        ]
    ).to_csv(out_dir / "segments_classified.csv", index=False)
    pd.DataFrame(columns=["ticker", "status", "fossil_share", "renewable_share", "nuclear_share", "basis", "quote"]).to_csv(
        out_dir / "generation_mix.csv", index=False
    )

    module = load_module(out_dir)
    result = module.apply_de_ben(inputs)
    by_ticker = result.set_index("ticker")

    assert by_ticker.at["NOSEG", "de_ben_status"] == "imputed"
    assert by_ticker.at["NOSEG", "de"] == pytest.approx(1.0)
    assert "de-ben-imputed" in by_ticker.at["NOSEG", "flags"]
