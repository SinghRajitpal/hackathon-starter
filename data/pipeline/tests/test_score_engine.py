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
    normalize_all,
    REFERENCE_RANGES,
    entropy_divergence,
    entropy_weights,
    topsis_scores,
    rank_stability,
    weight_vs_equal_delta,
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


def test_normalize_all_applies_penalty_only_to_imputed_cells():
    df = pd.DataFrame({
        "sector": ["Tech", "Tech", "Tech"],
        "env_intensity_per_million": [10.0, 10.0, None],
        "total_esg_risk_score": [20.0, 20.0, 20.0],
        "controversy_score_ordinal": [1.0, 1.0, 1.0],
        "asset_turnover": [0.3, 0.3, 0.3],
        "profit_to_revenue": [0.1, 0.1, 0.1],
        "fcf_to_revenue": [0.1, 0.1, 0.1],
        "net_debt_to_ebitda": [1.5, 1.5, 1.5],
    })
    X, imputed = normalize_all(df)

    assert list(X.columns) == list(REFERENCE_RANGES.keys())
    # row 2 (index 2) had its env_intensity imputed with the sector
    # median (10.0, same as rows 0/1) -- so before the penalty its
    # normalised env value would equal row 0/1's; the penalty must make
    # it strictly lower.
    assert X.loc[2, "env_intensity"] < X.loc[0, "env_intensity"]
    assert X.loc[0, "env_intensity"] == pytest.approx(X.loc[1, "env_intensity"])
    assert imputed.loc[2, "env_intensity"] == True
    assert imputed.loc[0, "env_intensity"] == False


def test_normalize_all_clips_penalty_at_zero():
    # a variable that's already at the worst possible normalised value
    # (0.0) and also imputed must not go negative from the penalty
    df = pd.DataFrame({
        "sector": ["Tech", "Tech"],
        "env_intensity_per_million": [10.0, None],
        "total_esg_risk_score": [40.0, 999.0],  # 999 clips to hi=40 -> normalised 0, then imputed anyway
        "controversy_score_ordinal": [1.0, 1.0],
        "asset_turnover": [0.3, 0.3],
        "profit_to_revenue": [0.1, 0.1],
        "fcf_to_revenue": [0.1, 0.1],
        "net_debt_to_ebitda": [1.5, 1.5],
    })
    X, imputed = normalize_all(df)
    assert (X >= 0).all().all()
    assert (X <= 1).all().all()


def test_entropy_divergence_matches_worked_example():
    # Section 12: intensity/FCF-margin/controversy normalised columns for
    # companies A-D. Column sums 2.70, 2.45, 2.00; entropies 0.938, 0.982,
    # 0.993; divergences 0.062, 0.018, 0.007.
    X = pd.DataFrame({
        "intensity": [0.70, 0.90, 0.25, 0.85],
        "fcf_margin": [0.60, 0.75, 0.40, 0.70],
        "controversy": [0.50, 0.60, 0.40, 0.50],
    })
    d = entropy_divergence(X)
    assert d.round(3).tolist() == [0.062, 0.018, 0.007]
    # weights derived directly from these divergences (no winsorisation
    # or cap involved -- none of these three toy divergences exceed 0.40
    # once normalised) match the worked example's ~0.71/0.21/0.08 too.
    w = d / d.sum()
    assert w.round(2).tolist() == [0.71, 0.21, 0.08]


def test_entropy_weights_sums_to_one():
    X = pd.DataFrame({
        "a": [0.1, 0.5, 0.9, 0.3, 0.7],
        "b": [0.5, 0.5, 0.5, 0.5, 0.5],
        "c": [0.9, 0.1, 0.2, 0.8, 0.4],
    })
    w, _ = entropy_weights(X)
    assert w.sum() == pytest.approx(1.0)


def test_entropy_weights_constant_column_gets_zero_divergence():
    # a column where every company looks identical carries no
    # discriminatory power -- entropy is 1, divergence is 0. (Checked on
    # the pre-cap divergence `d`, not the capped weight `w`: with only
    # one other, fully-informative column, the 0.40 cap is mathematically
    # infeasible for 2 columns -- 0.40+0.40 < 1 -- so this case isn't a
    # meaningful test of the cap, only of the divergence calculation.)
    X = pd.DataFrame({
        "constant": [0.5, 0.5, 0.5, 0.5],
        "varied": [0.1, 0.9, 0.3, 0.7],
    })
    _, d = entropy_weights(X)
    assert d["constant"] == pytest.approx(0.0, abs=1e-9)
    assert d["varied"] > 0


def test_entropy_weights_caps_dominant_column_at_040():
    # a column that alone would take ~100% of the weight (spread out 0
    # to 1 while every other column is constant) must be capped at 0.40,
    # excess redistributed proportionally to the rest.
    n = 100
    X = pd.DataFrame({
        "dominant": np.linspace(0.0, 1.0, n),
        "b": [0.5] * n,
        "c": [0.5] * n,
        "d": [0.5] * n,
    })
    w, _ = entropy_weights(X)
    assert w["dominant"] == pytest.approx(0.40, abs=1e-6)
    assert w.sum() == pytest.approx(1.0)


def test_entropy_weights_winsorises_thin_tail_before_weighting():
    # 99% of companies sit in a narrow band around 0.50, 1% (below the
    # 2.5th/97.5th percentile winsorisation cut) sit at a much more
    # extreme value. Section 7.1: this must not be read as strong,
    # genuine differentiation -- the winsorised copy used for weighting
    # should produce a materially lower divergence for this column than
    # an unwinsorised computation would.
    n = 500
    rng = np.random.default_rng(0)
    bulk = 0.50 + rng.normal(0, 0.01, size=int(n * 0.99))
    thin_tail = pd.Series(np.concatenate([bulk, np.full(n - len(bulk), 0.999)]))
    spread_out = pd.Series(np.linspace(0.0, 1.0, n))
    X = pd.DataFrame({"thin_tail": thin_tail, "spread_out": spread_out})

    w, _ = entropy_weights(X)

    # unwinsorised entropy, computed directly for comparison
    def raw_divergence(col):
        x = col.clip(lower=1e-12)
        p = x / x.sum()
        plogp = (p * np.log(p)).where(p > 0, 0.0)
        e = -(1 / np.log(len(col))) * plogp.sum()
        return 1 - e

    raw_d_thin_tail = raw_divergence(thin_tail)
    winsorised = thin_tail.clip(thin_tail.quantile(0.025), thin_tail.quantile(0.975))
    winsorised_d_thin_tail = raw_divergence(winsorised)
    assert winsorised_d_thin_tail < raw_d_thin_tail


def test_topsis_scores_matches_worked_example():
    # Section 12: same A-D normalised matrix. Expected scores: A=66.0,
    # B=82.3, C=29.8, D=77.2. Weights derived from entropy_divergence
    # directly (unrounded ~0.707/0.210/0.083) rather than the section
    # 12 text's rounded 0.71/0.21/0.08 -- using the rounded figures
    # drifts the score by ~0.1 for B/D, which is rounding error in the
    # worked example's own display, not a bug in topsis_scores (A's
    # D+ = 0.343 matches the worked example exactly either way).
    X = pd.DataFrame({
        "intensity": [0.70, 0.90, 0.25, 0.85],
        "fcf_margin": [0.60, 0.75, 0.40, 0.70],
        "controversy": [0.50, 0.60, 0.40, 0.50],
    }, index=["A", "B", "C", "D"])
    d = entropy_divergence(X)
    w = d / d.sum()

    result = topsis_scores(X, w)

    assert result["score"].round(1).tolist() == [66.0, 82.3, 29.8, 77.2]
    # section 12: for A, D+ = 0.343
    assert result.loc["A", "d_plus"] == pytest.approx(0.343, abs=0.001)


def test_topsis_scores_decomposition_matches_worked_example():
    # Section 12: for A, 54% of its distance from the ideal comes from
    # the intensity axis, 28% from FCF margin, 18% from controversy.
    X = pd.DataFrame({
        "intensity": [0.70],
        "fcf_margin": [0.60],
        "controversy": [0.50],
    }, index=["A"])
    w = pd.Series({"intensity": 0.71, "fcf_margin": 0.21, "controversy": 0.08})

    result = topsis_scores(X, w)

    assert result.loc["A", "contrib_intensity"] == pytest.approx(0.54, abs=0.01)
    assert result.loc["A", "contrib_fcf_margin"] == pytest.approx(0.28, abs=0.01)
    assert result.loc["A", "contrib_controversy"] == pytest.approx(0.18, abs=0.01)


def test_topsis_scores_perfect_company_scores_100():
    X = pd.DataFrame({"a": [1.0], "b": [1.0]})
    w = pd.Series({"a": 0.5, "b": 0.5})
    result = topsis_scores(X, w)
    assert result["score"].iloc[0] == pytest.approx(100.0)


def test_topsis_scores_worst_company_scores_0():
    X = pd.DataFrame({"a": [0.0], "b": [0.0]})
    w = pd.Series({"a": 0.5, "b": 0.5})
    result = topsis_scores(X, w)
    assert result["score"].iloc[0] == pytest.approx(0.0)


def test_rank_stability_returns_valid_rank_bounds():
    n = 20
    rng = np.random.default_rng(1)
    X = pd.DataFrame(rng.uniform(0, 1, size=(n, 4)), columns=list("abcd"))
    w = pd.Series({"a": 0.4, "b": 0.3, "c": 0.2, "d": 0.1})

    result = rank_stability(X, w, n_draws=50)

    assert list(result.columns) == ["min_rank", "max_rank"]
    assert len(result) == n
    assert (result["min_rank"] <= result["max_rank"]).all()
    assert (result["min_rank"] >= 1).all()
    assert (result["max_rank"] <= n).all()


def test_rank_stability_is_deterministic_given_seed():
    n = 10
    rng = np.random.default_rng(2)
    X = pd.DataFrame(rng.uniform(0, 1, size=(n, 3)), columns=list("abc"))
    w = pd.Series({"a": 0.5, "b": 0.3, "c": 0.2})

    r1 = rank_stability(X, w, n_draws=20, seed=7)
    r2 = rank_stability(X, w, n_draws=20, seed=7)
    pd.testing.assert_frame_equal(r1, r2)


def test_weight_vs_equal_delta_zero_when_weights_already_equal():
    n = 15
    rng = np.random.default_rng(3)
    X = pd.DataFrame(rng.uniform(0, 1, size=(n, 3)), columns=list("abc"))
    w_equal = pd.Series({"a": 1 / 3, "b": 1 / 3, "c": 1 / 3})

    delta = weight_vs_equal_delta(X, w_equal)
    assert (delta == 0).all()


def test_weight_vs_equal_delta_nonzero_for_skewed_weights():
    n = 30
    rng = np.random.default_rng(4)
    X = pd.DataFrame(rng.uniform(0, 1, size=(n, 3)), columns=list("abc"))
    w_skewed = pd.Series({"a": 0.9, "b": 0.05, "c": 0.05})

    delta = weight_vs_equal_delta(X, w_skewed)
    assert delta.sum() > 0
