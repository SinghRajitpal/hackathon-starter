import pandas as pd
import pytest

from nzlib import impute


def test_scope2_imputed_from_sector_median_intensity():
    df = pd.DataFrame(
        {
            "sector": ["X", "X", "X"],
            "e_scope2": [10.0, 30.0, None],
            "revenue_ttm": [100.0, 100.0, 50.0],
            "flags": [[], [], []],
        }
    )
    out = impute.impute_scope2(df)
    assert out.loc[2, "e_scope2"] == pytest.approx(10.0)
    assert out.loc[2, "flags"] == ["scope2-imputed"]


def test_wikirate_total_split_takes_fleet_first():
    shares = impute.sector_category_shares(
        pd.DataFrame({"sector": ["X", "X"], "combustion": [80.0, 60.0], "process": [20.0, 20.0], "fugitive": [0.0, 20.0]})
    )
    assert sum(shares["X"].values()) == pytest.approx(1.0)
    split = impute.split_wikirate_total(100.0, 20.0, {"combustion": 0.5, "process": 0.25, "fugitive": 0.25})
    assert split == {"fleet": 20.0, "combustion": 40.0, "process": 20.0, "fugitive": 20.0}
    assert impute.split_wikirate_total(10.0, 50.0, {"combustion": 1, "process": 0, "fugitive": 0})["fleet"] == 10.0
