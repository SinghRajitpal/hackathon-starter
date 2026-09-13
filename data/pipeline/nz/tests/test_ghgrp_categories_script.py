"""11_ghgrp_categories.py wiring for the hand-checked GHGRP parent-name alias map."""
import importlib.util
from pathlib import Path

import pandas as pd

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "11_ghgrp_categories.py"
REPO_ALIASES_PATH = Path(__file__).resolve().parents[1] / "maps" / "ghgrp_parent_aliases.csv"


def load_module():
    spec = importlib.util.spec_from_file_location("ghgrp_categories_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_load_aliases_reads_ticker_ghgrp_parent_name_evidence_columns(tmp_path):
    path = tmp_path / "aliases.csv"
    path.write_text('ticker,ghgrp_parent_name,evidence\nAPD,AIR PRODUCTS & CHEMICALS INC,"test evidence"\n')
    module = load_module()
    aliases = module.load_aliases(path)
    assert list(aliases.columns) == ["ticker", "ghgrp_parent_name", "evidence"]
    assert aliases.loc[0, ["ticker", "ghgrp_parent_name"]].tolist() == ["APD", "AIR PRODUCTS & CHEMICALS INC"]


def test_repo_alias_map_has_required_columns_and_no_duplicate_tickers():
    aliases = pd.read_csv(REPO_ALIASES_PATH)
    assert list(aliases.columns) == ["ticker", "ghgrp_parent_name", "evidence"]
    assert aliases["ticker"].is_unique
    assert (aliases["evidence"].str.len() > 0).all()


def test_default_aliases_path_points_at_the_committed_map():
    module = load_module()
    assert module.ALIASES_PATH.name == "ghgrp_parent_aliases.csv"
    aliases = module.load_aliases()
    assert set(aliases["ticker"]) >= {"APD", "DD", "WAB"}
