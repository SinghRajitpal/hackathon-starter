"""Missing-optional-input path for 17_build_inputs.py (ct_categories.csv, fleet.csv, ghgrp_categories.csv
are all optional — the script must still build one row per ticker, not crash)."""
import importlib.util
from pathlib import Path

import pandas as pd

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
