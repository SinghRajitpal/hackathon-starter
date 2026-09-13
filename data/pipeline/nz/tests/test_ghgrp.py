import pandas as pd

from nzlib import ghgrp


def direct_emitters_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Facility Id": [1, 2],
            "Total reported direct emissions": [100.0, 50.0],
            "Stationary Combustion": [60.0, None],
            "Electricity Generation": [10.0, None],
            "Cement Production": [20.0, None],
            "Petroleum Refining": [None, 30.0],
            "Petroleum and Natural Gas Systems – Processing": [10.0, 20.0],
            "Underground Coal Mines": [None, None],
            "Municipal Landfills": [None, None],
            "Industrial Wastewater Treatment": [None, None],
            "Industrial Waste Landfills": [None, None],
        }
    )


def test_direct_emitter_subparts_map_to_categories_and_sum_to_total():
    out = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    assert out.loc[0, ["combustion", "process", "fugitive"]].tolist() == [70.0, 20.0, 10.0]
    assert out.loc[1, ["combustion", "process", "fugitive"]].tolist() == [0.0, 30.0, 20.0]
    assert (out[["combustion", "process", "fugitive"]].sum(axis=1) == out["total"]).all()


def test_fugitive_sheet_is_all_fugitive():
    sheet = pd.DataFrame({"Facility Id": [7], "Total reported direct emissions from Transmission Pipelines": [12.0]})
    out = ghgrp.categorize_fugitive_sheet(sheet, "Total reported direct emissions from Transmission Pipelines")
    assert out.loc[0, ["total", "combustion", "process", "fugitive"]].tolist() == [12.0, 0.0, 0.0, 12.0]


def test_attribution_uses_majority_owner_once_per_facility():
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = pd.DataFrame(
        {
            "GHGRP FACILITY ID": [1, 1, 2],
            "PARENT COMPANY NAME": ["Acme Corp", "BlackRock Inc", "Acme Corporation"],
            "PARENT CO. PERCENT OWNERSHIP": [51.0, 49.0, 100.0],
        }
    )
    universe = pd.DataFrame({"ticker": ["ACME", "BLK"], "company_name": ["Acme Inc.", "BlackRock"]})
    out = ghgrp.attribute_to_tickers(facilities, parents, universe)
    assert out["ticker"].tolist() == ["ACME"]
    assert out.loc[0, "total"] == 150.0
