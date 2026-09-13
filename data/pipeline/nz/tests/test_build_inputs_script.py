"""Missing-optional-input path for 17_build_inputs.py (ct_categories.csv, fleet.csv, ghgrp_categories.csv
are all optional — the script must still build one row per ticker, not crash)."""
import importlib.util
from pathlib import Path

import pandas as pd
import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "17_build_inputs.py"


def load_module(out_dir: Path, universe_path: Path):
    spec = importlib.util.spec_from_file_location("build_inputs_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUT_DIR = out_dir
    module.UNIVERSE_PATH = universe_path
    module.FINANCIALS_PATH = out_dir / "financials_ttm.csv"
    module.GHGRP_PATH = out_dir / "ghgrp_categories.csv"  # missing
    module.CT_PATH = out_dir / "ct_categories.csv"  # missing
    module.FLEET_PATH = out_dir / "fleet.csv"  # missing
    module.SCOPE1_CORRECTIONS_PATH = out_dir / "scope1_corrections.csv"  # missing
    return module


def test_missing_ct_and_fleet_and_ghgrp_inputs_are_optional(tmp_path, capsys):
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    universe_path = tmp_path / "universe.csv"
    pd.DataFrame(
        [
            {
                "ticker": "AAA",
                "company_name": "Alpha Co",
                "sector": "Energy",
                "sub_industry": "Oil",
                "scope1_tco2e": 100.0,
                "scope1_source": "Wikirate/GRI",
                "scope2_tco2e": 50.0,
            }
        ]
    ).to_csv(universe_path, index=False)
    pd.DataFrame([{"ticker": "AAA", "revenue_ttm": 1000.0}]).to_csv(out_dir / "financials_ttm.csv", index=False)

    module = load_module(out_dir, universe_path)
    inputs, sources = module.build_frames()
    captured = capsys.readouterr()

    assert "missing optional input" in captured.out
    assert str(module.CT_PATH) in captured.out
    assert str(module.FLEET_PATH) in captured.out

    assert len(inputs) == 1
    row = inputs.iloc[0]
    # No GHGRP split and no Climate TRACE/fleet data: the reported Scope 1 total is split with the
    # no-peers fallback shares (all combustion) and flagged accordingly.
    assert row["e_combustion"] == 100.0
    assert row["e_fleet"] == 0.0
    assert "category-split-no-peers" in row["flags"]
    source_names = {s["source"] for s in sources.to_dict("records")}
    assert "ClimateTRACE" not in source_names
    assert "10-K fleet" not in source_names


def test_climate_trace_row_flags_are_carried_into_company_flags(tmp_path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    universe_path = tmp_path / "universe.csv"
    pd.DataFrame(
        [
            {
                "ticker": "BBB",
                "company_name": "Beta Co",
                "sector": "Energy",
                "sub_industry": "Oil",
                "scope1_tco2e": None,
                "scope1_source": None,
                "scope2_tco2e": None,
            }
        ]
    ).to_csv(universe_path, index=False)
    pd.DataFrame([{"ticker": "BBB", "revenue_ttm": 1000.0}]).to_csv(out_dir / "financials_ttm.csv", index=False)
    pd.DataFrame(
        [{"ticker": "BBB", "year": 2024, "assets_counted": 1, "combustion": 10.0, "fleet": None,
          "process": None, "fugitive": None, "flags": "ct-basin-aggregate-excluded"}]
    ).to_csv(out_dir / "ct_categories.csv", index=False)

    module = load_module(out_dir, universe_path)
    inputs, _ = module.build_frames()

    flags = inputs.iloc[0]["flags"]
    assert "ct-basin-aggregate-excluded" in flags
    assert "scope1-us-missing" in flags


def test_scope1_corrections_are_applied_and_flagged(tmp_path):
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    universe_path = tmp_path / "universe.csv"
    pd.DataFrame(
        [
            {
                "ticker": "CCC",
                "company_name": "Gamma Co",
                "sector": "Information Technology",
                "sub_industry": "Communications Equipment",
                "scope1_tco2e": 23000000.0,
                "scope1_source": "Wikirate/GRI",
                "scope2_tco2e": None,
            }
        ]
    ).to_csv(universe_path, index=False)
    pd.DataFrame([{"ticker": "CCC", "revenue_ttm": 1000.0}]).to_csv(out_dir / "financials_ttm.csv", index=False)
    pd.DataFrame(
        [
            {
                "ticker": "CCC",
                "year": 2021,
                "original_tco2e": 23000000.0,
                "corrected_tco2e": 34931.0,
                "source_url": "https://example.com/ccc",
                "note": "wrong scope",
            }
        ]
    ).to_csv(out_dir / "scope1_corrections.csv", index=False)

    module = load_module(out_dir, universe_path)
    inputs, _ = module.build_frames()

    row = inputs.iloc[0]
    assert row["e_combustion"] == pytest.approx(34931.0)
    assert "scope1-corrected" in row["flags"]
