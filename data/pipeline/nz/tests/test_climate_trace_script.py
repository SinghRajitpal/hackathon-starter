"""compute() in 12_climate_trace.py: basin-aggregate exclusion, run-log reporting and the
ct-basin-aggregate-excluded ticker flag (spec D13; fix for the Qatar_Rub al Khali_LNG-style
country-basin aggregates that were being equal-split as if they were verified owned assets)."""
import importlib.util
from pathlib import Path

import pandas as pd

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "12_climate_trace.py"


def load_module():
    spec = importlib.util.spec_from_file_location("climate_trace_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_basin_aggregate_source_is_excluded_and_flags_the_ticker(tmp_path, monkeypatch, capsys):
    module = load_module()
    module.OWNER_MAP_PATH = tmp_path / "ct_owner_map.csv"
    module.OUT_PATH = tmp_path / "ct_categories.csv"
    pd.DataFrame([{"ticker": "OXY", "owner_ids": "E1", "checked_by": "x", "note": "y"}]).to_csv(
        module.OWNER_MAP_PATH, index=False
    )

    sources = [
        {
            "id": "agg-1",
            "subsector": "oil-and-gas-production",
            "country": "QAT",
            "name": "Qatar_Rub al Khali_LNG",
            "emissionsQuantity": 56_600_000.0,
        },
        {
            "id": "asset-1",
            "subsector": "cement",
            "country": "MEX",
            "name": "Some Real Cement Plant",
            "emissionsQuantity": 10.0,
        },
    ]
    details = {"asset-1": {"owners": [{"id": "E1"}]}}

    monkeypatch.setattr(module, "sources_for_owner", lambda session, owner_id: sources)
    monkeypatch.setattr(module, "api_get", lambda session, path, **params: details.get(path.rsplit("/", 1)[-1]))

    module.compute(session=None)

    out = pd.read_csv(module.OUT_PATH)
    assert len(out) == 1
    row = out.iloc[0]
    assert row["ticker"] == "OXY"
    assert row["flags"] == "ct-basin-aggregate-excluded"
    assert row["process"] == 10.0
    assert row["assets_counted"] == 1  # the basin aggregate never reaches attribute()

    log = capsys.readouterr().out
    assert "Basin aggregates excluded: 1 sources, 56.60 Mt" in log


def test_ticker_with_no_basin_aggregate_is_not_flagged(tmp_path, monkeypatch, capsys):
    module = load_module()
    module.OWNER_MAP_PATH = tmp_path / "ct_owner_map.csv"
    module.OUT_PATH = tmp_path / "ct_categories.csv"
    pd.DataFrame([{"ticker": "CLEAN", "owner_ids": "E1", "checked_by": "x", "note": "y"}]).to_csv(
        module.OWNER_MAP_PATH, index=False
    )
    sources = [{"id": "asset-1", "subsector": "cement", "country": "MEX", "name": "Plant", "emissionsQuantity": 5.0}]
    monkeypatch.setattr(module, "sources_for_owner", lambda session, owner_id: sources)
    monkeypatch.setattr(
        module, "api_get", lambda session, path, **params: {"owners": [{"id": "E1"}]}
    )

    module.compute(session=None)

    out = pd.read_csv(module.OUT_PATH)
    assert out.iloc[0]["flags"] != "ct-basin-aggregate-excluded"
    assert "Basin aggregates excluded: 0 sources" in capsys.readouterr().out
