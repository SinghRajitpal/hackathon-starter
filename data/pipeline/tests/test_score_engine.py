import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from score_engine import (
    normalize_benefit,
    normalize_cost,
    normalize_log_cost,
    normalize_target_as_cost,
    impute_sector_median,
)


def test_normalize_benefit_matches_worked_example():
    # Section 12: FCF margin (benefit, range 0-20%). A=12, B=15, C=8, D=14.
    x = pd.Series([12.0, 15.0, 8.0, 14.0])
    result = normalize_benefit(x, lo=0.0, hi=20.0)
    assert result.round(2).tolist() == [0.60, 0.75, 0.40, 0.70]


def test_normalize_cost_matches_worked_example():
    # Section 12: Controversy level (cost, range 0-5). A=2.5, B=2.0, C=3.0, D=2.5.
    x = pd.Series([2.5, 2.0, 3.0, 2.5])
    result = normalize_cost(x, lo=0.0, hi=5.0)
    assert result.round(2).tolist() == [0.50, 0.60, 0.40, 0.50]


def test_normalize_cost_matches_worked_example_intensity():
    # Section 12: Intensity (cost, range 0-400). A=120, B=40, C=300, D=60.
    x = pd.Series([120.0, 40.0, 300.0, 60.0])
    result = normalize_cost(x, lo=0.0, hi=400.0)
    assert result.round(2).tolist() == [0.70, 0.90, 0.25, 0.85]


def test_normalize_cost_clips_outside_range():
    x = pd.Series([-10.0, 500.0])
    result = normalize_cost(x, lo=0.0, hi=400.0)
    assert result.tolist() == [1.0, 0.0]


def test_normalize_log_cost_worst_at_ceiling():
    # floor=1, lo=0, hi=2 -> a raw value of e^2 logs to exactly hi -> worst (0)
    x = pd.Series([np.e**2])
    result = normalize_log_cost(x, floor=1.0, lo=0.0, hi=2.0)
    assert result.round(6).tolist() == [0.0]


def test_normalize_log_cost_floors_small_values_to_best():
    # raw value below the floor (1.0) is clipped up to the floor before
    # logging -> log(1) = 0 = lo -> best possible (1.0)
    x = pd.Series([0.1])
    result = normalize_log_cost(x, floor=1.0, lo=0.0, hi=2.0)
    assert result.round(6).tolist() == [1.0]


def test_normalize_target_as_cost_best_at_target():
    # Net debt/EBITDA, t=1.5, hi=5: sitting exactly on target is best (1.0)
    x = pd.Series([1.5])
    result = normalize_target_as_cost(x, target=1.5, lo=0.0, hi=5.0)
    assert result.round(6).tolist() == [1.0]


def test_normalize_target_as_cost_worst_at_max_distance():
    # 1.5 + 5.0 = 6.5 is exactly hi distance away -> worst (0.0)
    x = pd.Series([6.5])
    result = normalize_target_as_cost(x, target=1.5, lo=0.0, hi=5.0)
    assert result.round(6).tolist() == [0.0]


def test_normalize_target_as_cost_symmetric():
    # too little (1.5 - 3 = -1.5) and too much (1.5 + 3 = 4.5) leverage
    # score identically -- both are distance 3 from the target
    x = pd.Series([-1.5, 4.5])
    result = normalize_target_as_cost(x, target=1.5, lo=0.0, hi=5.0)
    assert result.iloc[0] == pytest.approx(result.iloc[1])


def test_impute_sector_median_fills_and_flags():
    df = pd.DataFrame({
        "sector": ["Tech", "Tech", "Tech", "Energy", "Energy"],
        "val": [10.0, 20.0, None, 100.0, 200.0],
    })
    filled, missing = impute_sector_median(df, "sector", "val")
    assert filled.tolist() == [10.0, 20.0, 15.0, 100.0, 200.0]
    assert missing.tolist() == [False, False, True, False, False]


def test_impute_sector_median_never_leaves_nulls_when_sector_has_data():
    df = pd.DataFrame({
        "sector": ["A", "A", "A"],
        "val": [None, 5.0, 7.0],
    })
    filled, missing = impute_sector_median(df, "sector", "val")
    assert not filled.isna().any()
    assert missing.tolist() == [True, False, False]
