# Sustainability Evaluator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score and rank every S&P 500 company 0-100 by sustainability (environmental + social + financial/operational), using the entropy-weighted TOPSIS engine locked in the blueprint, and surface it as a leaderboard + per-company detail view in the existing Next.js app.

**Architecture:** One linear Python pipeline stage computes reference-range normalisation, entropy weights, and TOPSIS scores from the already-merged dataset (`data/out/sp500_esg_financials_raw.csv`), writes `data/out/sp500_esg_scores.csv`, and loads it into a new Supabase table. Next.js server components read that table for a universal leaderboard, a sector-filtered view of the *same* leaderboard (no second weighting pass), and a per-company detail panel. All scoring math lives in one pure-function module (`score_engine.py`) so it's unit-testable without hitting a database.

**Tech Stack:** Python 3.11+, pandas, numpy, pytest (new: engine unit tests). Existing Next.js 15 / React 19 / `@supabase/ssr` stack, no new frontend dependencies.

**Spec:** `/Users/prakhar/Downloads/sustainability-evaluator-blueprint-v1.4.pdf` (sections 3, 5-10 are the locked scoring design this plan implements; section 12's worked example is used below as unit-test ground truth; section 15 is this plan's build order).

**Test scope note:** TDD applies to the scoring engine (`score_engine.py`) only — the blueprint gives exact expected numbers (section 12) to test against, and a ranking engine is exactly the kind of code where a silent math regression is expensive. The repo has no existing frontend test setup (`package.json` has no test runner) and this plan doesn't add one; frontend tasks end with a manual verification step against the running dev server instead, matching the codebase's current convention.

## Global Constraints

- Blueprint sections 3, 5, 6, 7, 8 are marked "Locked" (PDF page 11) — changes to them require a decisions-log entry. This plan makes three such changes, agreed with the user in chat on 2026-09-13, recorded here:
  1. **No company is ever excluded from the ranking.** Blueprint section 6 rule: "Companies missing more than a third of the variables are excluded from the ranking and listed separately." On the real dataset this would exclude 97 companies (93 missing exactly 3 of 7 variables — always Scope 1+2 intensity + ESG risk score + controversy level together — plus 4 missing 4 of 7). Overridden: every company is scored and ranked, no separate excluded list.
  2. **No user-facing indication that a value was imputed, anywhere.** Blueprint section 6 rule: "the imputation is flagged in its detail view." Overridden: nothing in the UI, API response consumed by the client, or generated explanation text says a value was imputed. `score_engine.py` still computes an internal imputed-mask (needed to apply the penalty below and useful for future debugging), but it is never written to the Supabase table or read by any Next.js code.
  3. **The 0.05 disclosure penalty is kept, applied silently.** Blueprint section 6: "a configurable disclosure penalty (default 0.05 on the normalised scale) is subtracted so that opacity is not rewarded." Kept exactly as specified — an imputed company's score is quietly ~0.05/axis lower on the normalised scale than a company that actually reported the value — just never surfaced as a message.
- **Amendment, 2026-09-13 (during execution, Task 7):** a fourth locked-section change, agreed with the user in chat: **rank stability (blueprint section 10's 1,000-draw Dirichlet re-weighting/re-ranking robustness check) is dropped entirely** — not computed, not stored, not displayed. `rank_stability()` was implemented and unit-tested in Task 3/5 execution, then removed (function + tests) once this decision was made, since it became dead code. Task 5's steps below are kept as written for the historical record of what was built and then removed; Tasks 6, 7, 10 below are edited to match the final state (no `rank_min`/`rank_max` anywhere).
- **Amendment, 2026-09-13 (later same session):** a fifth locked-section change — **`weight_vs_equal_delta` (section 10's other robustness output, the "does the weighting even matter" equal-weight comparison) is also dropped entirely**, not just rank stability. Same reasoning: user wants entropy-derived weights only, with equal weighting never computed anywhere, not even as a diagnostic comparison. `weight_vs_equal_delta()` was implemented, unit-tested, and used in `09_score.py`/the schema, then removed (function + tests + `rank_delta_vs_equal` column) once this decision was made. Section 10 therefore ships with **no robustness outputs at all** in this build — score, rank, sector_rank, weights, and per-axis decomposition only. Task 5's and Task 6's steps below are kept as originally written for the historical record; their "Produces"/interface lines and Task 7's schema are corrected to the final state.
- Reference ranges (lo/hi per variable) are frozen constants, checked against the real 503-company dataset on 2026-09-13 (see `score_engine.py`'s module docstring for the per-variable justification) — never recomputed at request time.
- Universal view and sector view must share one computation (blueprint section 9): the sector view is a filter + renumber of the same score table, never a second entropy/TOPSIS pass.
- `controversy_level` in the blueprint's variable table (section 11) refers to the numeric 0-5 ordinal already computed in this repo as `controversy_score_ordinal` (derived from the text categories in the raw `controversy_level` column via `CONTROVERSY_ORDER` in `06_zscores.py`) — not that raw text column directly.

---

## Task 1: Reference ranges, direction normalisation, and missing-value imputation

**Files:**
- Create: `data/pipeline/score_engine.py`
- Test: `data/pipeline/tests/test_score_engine.py`
- Modify: `data/pipeline/requirements.txt`

**Interfaces:**
- Produces: `REFERENCE_RANGES: dict[str, dict]`, `RAW_COLUMNS: dict[str, str]`, `normalize_benefit(x: pd.Series, lo: float, hi: float) -> pd.Series`, `normalize_cost(x: pd.Series, lo: float, hi: float) -> pd.Series`, `normalize_log_cost(x: pd.Series, floor: float, lo: float, hi: float) -> pd.Series`, `normalize_target_as_cost(x: pd.Series, target: float, lo: float, hi: float) -> pd.Series`, `impute_sector_median(df: pd.DataFrame, sector_col: str, raw_col: str) -> tuple[pd.Series, pd.Series]`, `DISCLOSURE_PENALTY: float = 0.05` — all consumed by Task 2 and Task 4.

- [ ] **Step 1: Write the failing tests for direction normalisation**

```python
# data/pipeline/tests/test_score_engine.py
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from score_engine import (
    normalize_benefit,
    normalize_cost,
    normalize_log_cost,
    normalize_target_as_cost,
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
    import numpy as np

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'score_engine'`

- [ ] **Step 3: Create `score_engine.py` with reference ranges and normalisation functions**

```python
"""
Core entropy-weighted TOPSIS scoring engine for the Sustainability
Evaluator. Pure functions only, no file I/O, so every function here is
independently unit-testable (see tests/test_score_engine.py) without a
database or the real dataset.

Blueprint: sustainability-evaluator-blueprint-v1.4.pdf, sections 3, 5-10.
Sections 3, 5, 6, 7, 8 of that document are marked "Locked" -- any change
to the math here needs a decisions-log entry. Three such changes are
already made and recorded in this plan's Global Constraints
(docs/superpowers/plans/2026-09-13-sustainability-evaluator.md): no
company is ever excluded from the ranking, no imputation is surfaced to
the user, and the 0.05 disclosure penalty is kept but applied silently.

Reference ranges below are frozen constants, checked against the real
503-company dataset (data/out/sp500_esg_financials_raw.csv) on
2026-09-13, per the written-justification requirement in blueprint
section 6.1:

- env_intensity (Scope 1+2 tCO2e per USD million revenue, log-transformed,
  cost): floor=1.0 (so log >= 0; real data's minimum non-null value is
  0.105, so this floor legitimately compresses a handful of very-clean
  companies to the same best score rather than fabricating a distinction
  the data can't support). hi = ln(97.5th percentile of the real
  distribution) = ln(2344.84) = 7.7599, frozen at first run.
- esg_risk (Sustainalytics Total ESG Risk Score, cost): lo=0, hi=40, the
  vendor's own documented "severe risk" threshold -- kept as-is even
  though 4 real companies score slightly above it (41.7 max); those clip
  to the worst score, which is correct behaviour for a documented
  external ceiling.
- controversy (Sustainalytics controversy level mapped to the 0-5
  ordinal scale already computed in this repo as
  `controversy_score_ordinal`, cost): lo=0, hi=5, the vendor's own
  documented ordinal bound.
- asset_turnover (benefit): lo=0, hi=97.5th percentile of the real
  distribution = 0.6306, frozen at first run (open-ended ratio, no
  natural ceiling per blueprint).
- profit_margin (net margin, benefit): lo=-0.20, the blueprint's example
  distress floor -- checked against real data: only 1.79% of companies
  fall below it, confirming it catches a genuine tail rather than the
  bulk of the index. hi = 97.5th percentile = 0.5209, frozen.
- fcf_margin (benefit): lo=-0.20, same distress floor as profit_margin
  for consistency -- checked: 4.79% of real companies fall below it,
  still a minority tail. hi = 97.5th percentile = 0.6033, frozen.
- leverage (Net debt/EBITDA, target t=1.5, converted to cost via
  d=|x-t|): lo=0, hi=26.8178. The blueprint's own table lists this as
  provisional ("largest distance considered, e.g. 5") pending the real-
  data check section 6.1 requires. That check: at hi=5, 53% of real
  companies would have d > 5 and clip to the worst possible leverage
  score -- not defensible. There's no documented external ceiling for
  this distance (unlike esg_risk's vendor threshold), so per section 6's
  fallback rule the ceiling is set to the 97.5th percentile of the real
  distance distribution instead: 26.8178, frozen at first run. (Real data
  also has one extreme outlier, -603.24, from a near-zero-EBITDA
  denominator; the percentile ceiling naturally clips it without special
  handling, and the winsorised copy in `entropy_weights` below prevents
  it from distorting the leverage axis's weight.)

Correlation check (blueprint section 4 gate, run once against the real,
final normalised+penalised matrix): max |r| = 0.455 (env vs esg_risk).
All 7 variables kept, none dropped -- well under the 0.8 threshold.

Entropy-vs-CRITIC decision (blueprint section 7.1): entropy weights on
the real first run range from 4.6% to 36.9%, none reaching the 0.40 cap
-- not lopsided or unstable, so entropy is kept; the CRITIC fallback is
not needed. (`entropy_weights` below still applies the cap/guardrail
unconditionally, since blueprint section 7.1 requires it regardless of
whether it triggers on any given run's data.)
"""
import numpy as np
import pandas as pd

REFERENCE_RANGES = {
    "env_intensity": dict(kind="log_cost", floor=1.0, lo=0.0, hi=7.7599),
    "esg_risk": dict(kind="cost", lo=0.0, hi=40.0),
    "controversy": dict(kind="cost", lo=0.0, hi=5.0),
    "asset_turnover": dict(kind="benefit", lo=0.0, hi=0.6306),
    "profit_margin": dict(kind="benefit", lo=-0.20, hi=0.5209),
    "fcf_margin": dict(kind="benefit", lo=-0.20, hi=0.6033),
    "leverage": dict(kind="target", target=1.5, lo=0.0, hi=26.8178),
}

# score_engine variable name -> raw column name in
# data/out/sp500_esg_financials_raw.csv. env_intensity's raw column
# (env_intensity_per_million) is derived in 09_score.py from the
# existing emissions_intensity_per_revenue column (* 1e6, to get tCO2e
# per USD million revenue instead of per USD).
RAW_COLUMNS = {
    "env_intensity": "env_intensity_per_million",
    "esg_risk": "total_esg_risk_score",
    "controversy": "controversy_score_ordinal",
    "asset_turnover": "asset_turnover",
    "profit_margin": "profit_to_revenue",
    "fcf_margin": "fcf_to_revenue",
    "leverage": "net_debt_to_ebitda",
}

DISCLOSURE_PENALTY = 0.05
WEIGHT_CAP = 0.40
WINSOR_LO, WINSOR_HI = 0.025, 0.975


def normalize_benefit(x: pd.Series, lo: float, hi: float) -> pd.Series:
    """Section 5: benefit variable, more is better. 1 = best."""
    return (x.clip(lower=lo, upper=hi) - lo) / (hi - lo)


def normalize_cost(x: pd.Series, lo: float, hi: float) -> pd.Series:
    """Section 5: cost variable, less is better. 1 = best."""
    return (hi - x.clip(lower=lo, upper=hi)) / (hi - lo)


def normalize_log_cost(x: pd.Series, floor: float, lo: float, hi: float) -> pd.Series:
    """Section 6: heavy-tailed cost variable, log-transformed before the
    fixed-range normalisation described in normalize_cost."""
    logged = np.log(x.clip(lower=floor))
    return normalize_cost(logged, lo, hi)


def normalize_target_as_cost(x: pd.Series, target: float, lo: float, hi: float) -> pd.Series:
    """Section 5: target variable with an optimum in the middle. Converted
    to a distance-from-target, then treated as a cost (less distance is
    better)."""
    distance = (x - target).abs()
    return normalize_cost(distance, lo, hi)


def impute_sector_median(df: pd.DataFrame, sector_col: str, raw_col: str) -> tuple[pd.Series, pd.Series]:
    """Section 6: a missing value is filled with the company's GICS-sector
    median for that variable -- never dropped. Returns (filled, missing)
    where `missing` is a boolean mask kept for internal use only (the
    disclosure penalty in normalize_all below); per this plan's Global
    Constraints it must never be surfaced to the user."""
    sector_median = df.groupby(sector_col)[raw_col].transform("median")
    missing = df[raw_col].isna()
    filled = df[raw_col].where(~missing, sector_median)
    return filled, missing
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing test for imputation**

```python
# append to data/pipeline/tests/test_score_engine.py
from score_engine import impute_sector_median


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
```

- [ ] **Step 6: Run test to verify it fails, then re-run all to verify pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: all PASS (11 tests) -- `impute_sector_median` was already implemented in Step 3.

- [ ] **Step 7: Add pytest and numpy to requirements.txt**

```python
# data/pipeline/requirements.txt -- add these two lines (numpy was an
# undeclared transitive dependency of pandas; 06_zscores.py already
# imports it directly, so make it explicit)
numpy>=1.26
pytest>=8.0
```

- [ ] **Step 8: Commit**

```bash
git add data/pipeline/score_engine.py data/pipeline/tests/test_score_engine.py data/pipeline/requirements.txt
git commit -m "feat: add reference-range normalisation and sector-median imputation to score_engine"
```

---

## Task 2: Silent disclosure penalty and the full normalisation matrix

**Files:**
- Modify: `data/pipeline/score_engine.py`
- Modify: `data/pipeline/tests/test_score_engine.py`

**Interfaces:**
- Consumes: everything from Task 1 (`REFERENCE_RANGES`, `RAW_COLUMNS`, `normalize_*`, `impute_sector_median`, `DISCLOSURE_PENALTY`).
- Produces: `normalize_all(df: pd.DataFrame, sector_col: str = "sector") -> tuple[pd.DataFrame, pd.DataFrame]` — returns `(X, imputed)`, both indexed like `df`, `X` columns are the 7 keys of `REFERENCE_RANGES`. Consumed by Task 3 (`entropy_weights(X)`) and Task 4 (`topsis_scores(X, w)`). `imputed` is for internal/audit use only — Task 6's pipeline runner must not write it to the output CSV or Supabase table.

- [ ] **Step 1: Write the failing test**

```python
# append to data/pipeline/tests/test_score_engine.py
from score_engine import normalize_all, REFERENCE_RANGES


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: FAIL with `ImportError: cannot import name 'normalize_all'`

- [ ] **Step 3: Implement `normalize_all`**

```python
# append to data/pipeline/score_engine.py

def normalize_all(df: pd.DataFrame, sector_col: str = "sector") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Runs impute -> direction+range normalise -> silent disclosure
    penalty for every variable in REFERENCE_RANGES, in that order (fixed
    per blueprint section 15). Returns (X, imputed): X is the final 0-1
    matrix that both entropy_weights and topsis_scores read from;
    imputed is a same-shape boolean DataFrame for internal auditing only
    -- per this plan's Global Constraints, never written to any output
    the frontend reads."""
    X = pd.DataFrame(index=df.index)
    imputed = pd.DataFrame(index=df.index)

    for name, spec in REFERENCE_RANGES.items():
        raw_col = RAW_COLUMNS[name]
        filled, missing = impute_sector_median(df, sector_col, raw_col)
        imputed[name] = missing

        if spec["kind"] == "benefit":
            col = normalize_benefit(filled, spec["lo"], spec["hi"])
        elif spec["kind"] == "cost":
            col = normalize_cost(filled, spec["lo"], spec["hi"])
        elif spec["kind"] == "log_cost":
            col = normalize_log_cost(filled, spec["floor"], spec["lo"], spec["hi"])
        elif spec["kind"] == "target":
            col = normalize_target_as_cost(filled, spec["target"], spec["lo"], spec["hi"])
        else:
            raise ValueError(f"unknown reference-range kind: {spec['kind']}")

        X[name] = (col - DISCLOSURE_PENALTY * missing.astype(float)).clip(lower=0.0, upper=1.0)

    return X, imputed
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add data/pipeline/score_engine.py data/pipeline/tests/test_score_engine.py
git commit -m "feat: add normalize_all with silent disclosure penalty"
```

---

## Task 3: Entropy weighting with the winsorisation and cap guardrails

**Files:**
- Modify: `data/pipeline/score_engine.py`
- Modify: `data/pipeline/tests/test_score_engine.py`

**Interfaces:**
- Consumes: `X: pd.DataFrame` from Task 2's `normalize_all`.
- Produces: `entropy_weights(X: pd.DataFrame) -> tuple[pd.Series, pd.Series]` — `(w, d)`, both indexed by `X`'s columns, `w` sums to 1.0. Consumed by Task 4 (`topsis_scores`) and Task 6 (pipeline runner, to persist the weight vector for the UI). Task 5 originally also consumed it for `rank_stability`/`weight_vs_equal_delta`; both were later removed (Global Constraints amendments).

- [ ] **Step 1: Write the failing test using the section 12 worked example**

```python
# append to data/pipeline/tests/test_score_engine.py
from score_engine import entropy_weights


def test_entropy_weights_matches_worked_example():
    # Section 12: intensity/FCF-margin/controversy normalised columns for
    # companies A-D. Column sums 2.70, 2.45, 2.00; entropies 0.938, 0.982,
    # 0.993; divergences 0.062, 0.018, 0.007; weights ~0.71, 0.21, 0.08.
    X = pd.DataFrame({
        "intensity": [0.70, 0.90, 0.25, 0.85],
        "fcf_margin": [0.60, 0.75, 0.40, 0.70],
        "controversy": [0.50, 0.60, 0.40, 0.50],
    })
    w, d = entropy_weights(X)
    assert d.round(3).tolist() == [0.062, 0.018, 0.007]
    assert w.round(2).tolist() == [0.71, 0.21, 0.08]


def test_entropy_weights_sums_to_one():
    X = pd.DataFrame({
        "a": [0.1, 0.5, 0.9, 0.3, 0.7],
        "b": [0.5, 0.5, 0.5, 0.5, 0.5],
        "c": [0.9, 0.1, 0.2, 0.8, 0.4],
    })
    w, _ = entropy_weights(X)
    assert w.sum() == pytest.approx(1.0)


def test_entropy_weights_constant_column_gets_zero_weight():
    # a column where every company looks identical carries no
    # discriminatory power -- entropy is 1, divergence is 0, weight is 0
    X = pd.DataFrame({
        "constant": [0.5, 0.5, 0.5, 0.5],
        "varied": [0.1, 0.9, 0.3, 0.7],
    })
    w, _ = entropy_weights(X)
    assert w["constant"] == pytest.approx(0.0, abs=1e-9)
    assert w["varied"] == pytest.approx(1.0, abs=1e-9)


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
    # 96% of companies sit in a narrow band (0.50), 4% sit at the
    # extreme (0.99). Section 7.1: this must not be read as strong,
    # genuine differentiation -- the winsorised copy used for weighting
    # should produce a materially lower weight for this column than an
    # unwinsorised computation would.
    n = 500
    thin_tail = pd.Series([0.50] * int(n * 0.96) + [0.99] * int(n * 0.04))
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: FAIL with `ImportError: cannot import name 'entropy_weights'`

- [ ] **Step 3: Implement `entropy_weights`**

```python
# append to data/pipeline/score_engine.py

def entropy_weights(X: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Section 7 (standard entropy weight method) + section 7.1's
    guardrails: entropy is computed on a winsorised (2.5th/97.5th
    percentile clipped) COPY of X, never on X itself -- X is untouched
    and is what topsis_scores reads from. The resulting weights are
    capped at WEIGHT_CAP (0.40); any excess above the cap is
    redistributed proportionally across the uncapped columns. Binary
    variables are out of scope for this project's confirmed 7-variable
    set (see section 11), so that guardrail doesn't apply here.

    Returns (w, d): w sums to 1.0, d is the per-column divergence
    1 - entropy (both before the cap is applied, for display/debugging)."""
    n = len(X)
    Xw = X.copy()
    for col in Xw.columns:
        lo_w, hi_w = Xw[col].quantile(WINSOR_LO), Xw[col].quantile(WINSOR_HI)
        Xw[col] = Xw[col].clip(lower=lo_w, upper=hi_w)

    d = {}
    for col in Xw.columns:
        x = Xw[col].clip(lower=1e-12)
        p = x / x.sum()
        plogp = (p * np.log(p)).where(p > 0, 0.0)
        e = -(1.0 / np.log(n)) * plogp.sum()
        d[col] = 1.0 - e
    d = pd.Series(d)

    if d.sum() == 0:
        w = pd.Series(1.0 / len(d), index=d.index)
    else:
        w = d / d.sum()

    for _ in range(10):
        over = w[w > WEIGHT_CAP].index
        if len(over) == 0:
            break
        excess = (w[over] - WEIGHT_CAP).sum()
        w[over] = WEIGHT_CAP
        under = w.index.difference(over)
        w[under] = w[under] + excess * (w[under] / w[under].sum())

    return w, d
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add data/pipeline/score_engine.py data/pipeline/tests/test_score_engine.py
git commit -m "feat: add entropy_weights with winsorisation and 0.40 cap guardrails"
```

---

## Task 4: TOPSIS scoring and per-axis decomposition

**Files:**
- Modify: `data/pipeline/score_engine.py`
- Modify: `data/pipeline/tests/test_score_engine.py`

**Interfaces:**
- Consumes: `X: pd.DataFrame` (Task 2), `w: pd.Series` (Task 3).
- Produces: `topsis_scores(X: pd.DataFrame, w: pd.Series) -> pd.DataFrame` — columns `d_plus`, `d_minus`, `score`, and one `contrib_<var>` per column of `X` (share of the company's total distance-to-ideal attributable to that axis, sums to 1.0 per row). Consumed by Task 5 and Task 6.

- [ ] **Step 1: Write the failing test using the section 12 worked example**

```python
# append to data/pipeline/tests/test_score_engine.py
from score_engine import topsis_scores


def test_topsis_scores_matches_worked_example():
    # Section 12: same A-D normalised matrix, weights 0.71/0.21/0.08.
    # Expected scores: A=66.0, B=82.3, C=29.8, D=77.2.
    X = pd.DataFrame({
        "intensity": [0.70, 0.90, 0.25, 0.85],
        "fcf_margin": [0.60, 0.75, 0.40, 0.70],
        "controversy": [0.50, 0.60, 0.40, 0.50],
    }, index=["A", "B", "C", "D"])
    w = pd.Series({"intensity": 0.71, "fcf_margin": 0.21, "controversy": 0.08})

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: FAIL with `ImportError: cannot import name 'topsis_scores'`

- [ ] **Step 3: Implement `topsis_scores`**

```python
# append to data/pipeline/score_engine.py

def topsis_scores(X: pd.DataFrame, w: pd.Series) -> pd.DataFrame:
    """Section 8: ideal point A+ is all-ones, anti-ideal A- is all-zeros.
    D+/D- are the weighted Euclidean distances to each; score is
    100 * D- / (D+ + D-), so 100 means sitting exactly on the ideal
    (never actually reached -- see blueprint section 8).

    Also computes the per-axis decomposition that backs the explanation
    layer (blueprint section 8): the squared weighted gap to the ideal,
    wj*(1-xij)^2, as a share of the company's total D+^2 -- the "how
    much of this company's distance from the ideal does each variable
    explain" number."""
    w = w.reindex(X.columns)
    gaps_to_ideal = w * (1.0 - X) ** 2
    gaps_to_antiideal = w * X ** 2

    d_plus = np.sqrt(gaps_to_ideal.sum(axis=1))
    d_minus = np.sqrt(gaps_to_antiideal.sum(axis=1))
    score = 100.0 * d_minus / (d_plus + d_minus)

    out = pd.DataFrame({"d_plus": d_plus, "d_minus": d_minus, "score": score}, index=X.index)

    total_gap = gaps_to_ideal.sum(axis=1)
    for col in X.columns:
        out[f"contrib_{col}"] = (gaps_to_ideal[col] / total_gap).fillna(0.0)

    return out
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: PASS (22 tests)

- [ ] **Step 5: Commit**

```bash
git add data/pipeline/score_engine.py data/pipeline/tests/test_score_engine.py
git commit -m "feat: add topsis_scores with per-axis distance decomposition"
```

---

## Task 5: Rank stability and weight-vs-equal comparison

**Files:**
- Modify: `data/pipeline/score_engine.py`
- Modify: `data/pipeline/tests/test_score_engine.py`

**Interfaces:**
- Consumes: `X: pd.DataFrame`, `w: pd.Series` (Tasks 2-3), `topsis_scores` (Task 4).
- Produces: `rank_stability(X: pd.DataFrame, w: pd.Series, n_draws: int = 1000, concentration: float = 200.0, seed: int = 42) -> pd.DataFrame` (columns `min_rank`, `max_rank`, indexed like `X`) and `weight_vs_equal_delta(X: pd.DataFrame, w: pd.Series) -> pd.Series` (`|rank_entropy - rank_equal|` per company). Both consumed by Task 6 (pipeline runner) to populate leaderboard columns read by Task 8 (frontend).

- [ ] **Step 1: Write the failing test**

```python
# append to data/pipeline/tests/test_score_engine.py
from score_engine import rank_stability, weight_vs_equal_delta


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: FAIL with `ImportError: cannot import name 'rank_stability'`

- [ ] **Step 3: Implement `rank_stability` and `weight_vs_equal_delta`**

```python
# append to data/pipeline/score_engine.py

def rank_stability(
    X: pd.DataFrame,
    w: pd.Series,
    n_draws: int = 1000,
    concentration: float = 200.0,
    seed: int = 42,
) -> pd.DataFrame:
    """Section 10: perturbs w via n_draws Dirichlet draws centred on the
    entropy weights (higher `concentration` = tighter draws around w)
    and recomputes the ranking each time. Companies whose rank barely
    moves are robustly placed; companies whose rank swings widely are
    weight-sensitive. Computed once per pipeline run, not per request."""
    rng = np.random.default_rng(seed)
    alpha = w.reindex(X.columns).to_numpy() * concentration
    ranks = np.empty((n_draws, len(X)), dtype=int)

    for i in range(n_draws):
        w_draw = pd.Series(rng.dirichlet(alpha), index=X.columns)
        draw_scores = topsis_scores(X, w_draw)["score"]
        ranks[i] = draw_scores.rank(ascending=False, method="min").to_numpy()

    return pd.DataFrame(
        {"min_rank": ranks.min(axis=0), "max_rank": ranks.max(axis=0)},
        index=X.index,
    )


def weight_vs_equal_delta(X: pd.DataFrame, w: pd.Series) -> pd.Series:
    """Section 10: |rank under entropy weights - rank under equal
    weights| per company -- the direct answer to "does the weighting
    even matter?". Blueprint reports how many companies move by more
    than 25 places; callers filter/count that threshold themselves."""
    w_equal = pd.Series(1.0 / len(w), index=w.index)
    rank_entropy = topsis_scores(X, w)["score"].rank(ascending=False, method="min")
    rank_equal = topsis_scores(X, w_equal)["score"].rank(ascending=False, method="min")
    return (rank_entropy - rank_equal).abs()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd data/pipeline && python -m pytest tests/test_score_engine.py -v`
Expected: PASS (26 tests)

- [ ] **Step 5: Commit**

```bash
git add data/pipeline/score_engine.py data/pipeline/tests/test_score_engine.py
git commit -m "feat: add rank_stability and weight_vs_equal_delta robustness outputs"
```

---

## Task 6: Pipeline runner — `09_score.py`

**Files:**
- Create: `data/pipeline/09_score.py`

**Interfaces:**
- Consumes: `data/out/sp500_esg_financials_raw.csv` (existing, from `05_merge.py`/`08_fetch_epa_scope1.py`); `score_engine.normalize_all`, `entropy_weights`, `topsis_scores`, `REFERENCE_RANGES` (Tasks 1-4).
- Produces: `data/out/sp500_esg_scores.csv` with columns: `ticker`, `company_name`, `sector`, `sub_industry`, `score`, `rank`, `sector_rank`, `d_plus`, `d_minus`, one `weight_<var>` and `contrib_<var>` per the 7 `REFERENCE_RANGES` keys, one `<var>_raw` per variable (the post-imputation display value — silently includes sector-median fills, per Global Constraints). No `imputed` column and no robustness-output columns (`rank_min`/`rank_max`, `rank_delta_vs_equal`) are written — both of section 10's robustness outputs were dropped (Global Constraints amendments). Consumed by Task 7's loader.

- [ ] **Step 1: Write `09_score.py`**

```python
"""
Computes the Sustainability Evaluator score for every company in
data/out/sp500_esg_financials_raw.csv using score_engine.py (blueprint
sections 5-10), and writes data/out/sp500_esg_scores.csv.

Sector rank is a display-time renumbering of this same universal
ranking (blueprint section 9) -- not a second weighting pass. No
`imputed` column is written here: per this plan's Global Constraints
(docs/superpowers/plans/2026-09-13-sustainability-evaluator.md), no
company is excluded and no imputation is ever surfaced downstream.

Input: data/out/sp500_esg_financials_raw.csv (output of 05_merge.py,
08_fetch_epa_scope1.py)
Output: data/out/sp500_esg_scores.csv
"""
import numpy as np
import pandas as pd

from score_engine import (
    REFERENCE_RANGES,
    entropy_weights,
    normalize_all,
    rank_stability,
    topsis_scores,
    weight_vs_equal_delta,
)

IN_PATH = "../out/sp500_esg_financials_raw.csv"
OUT_PATH = "../out/sp500_esg_scores.csv"

ID_COLUMNS = ["ticker", "company_name", "sector", "sub_industry"]


def main():
    df = pd.read_csv(IN_PATH)

    # env_intensity's raw column, in tCO2e per USD million revenue --
    # derived here from the existing emissions_intensity_per_revenue
    # column (tCO2e per USD), see score_engine.py's module docstring.
    df["env_intensity_per_million"] = df["emissions_intensity_per_revenue"] * 1e6

    X, imputed = normalize_all(df)
    w, _d = entropy_weights(X)
    scored = topsis_scores(X, w)
    stability = rank_stability(X, w)
    rank_delta = weight_vs_equal_delta(X, w)

    out = df[ID_COLUMNS].copy()
    out["score"] = scored["score"]
    out["rank"] = scored["score"].rank(ascending=False, method="min").astype(int)
    out["sector_rank"] = (
        out.groupby("sector")["score"].rank(ascending=False, method="min").astype(int)
    )
    out["d_plus"] = scored["d_plus"]
    out["d_minus"] = scored["d_minus"]

    for var in REFERENCE_RANGES:
        out[f"weight_{var}"] = w[var]
        out[f"contrib_{var}"] = scored[f"contrib_{var}"]

    raw_display = df[ID_COLUMNS].copy()
    for var, raw_col in {
        "env_intensity": "env_intensity_per_million",
        "esg_risk": "total_esg_risk_score",
        "controversy": "controversy_score_ordinal",
        "asset_turnover": "asset_turnover",
        "profit_margin": "profit_to_revenue",
        "fcf_margin": "fcf_to_revenue",
        "leverage": "net_debt_to_ebitda",
    }.items():
        filled = df[raw_col].where(~imputed[var], df.groupby("sector")[raw_col].transform("median"))
        out[f"{var}_raw"] = filled

    out["rank_min"] = stability["min_rank"]
    out["rank_max"] = stability["max_rank"]
    out["rank_delta_vs_equal"] = rank_delta

    out = out.sort_values("rank")
    out.to_csv(OUT_PATH, index=False)

    print(f"Wrote {len(out)} rows to {OUT_PATH}")
    print(f"Weights: {dict(w.round(4))}")
    moved_more_than_25 = (rank_delta > 25).sum()
    print(f"Companies moving >25 ranks vs equal weighting: {moved_more_than_25}/{len(out)}")
    print(f"Companies with >=1 imputed variable: {imputed.any(axis=1).sum()}/{len(out)} (not surfaced downstream)")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the pipeline stage against the real dataset**

Run: `cd data/pipeline && python 09_score.py`
Expected: `Wrote 503 rows to ../out/sp500_esg_scores.csv`, weights roughly matching the frozen first-run values in `score_engine.py`'s docstring (env ~0.136, esg_risk ~0.084, controversy ~0.046, asset_turnover ~0.369, profit_margin ~0.074, fcf_margin ~0.187, leverage ~0.103), no exceptions, no company dropped (`len(out) == 503`).

- [ ] **Step 3: Spot-check the output CSV**

Run: `cd data/pipeline && python -c "import pandas as pd; df = pd.read_csv('../out/sp500_esg_scores.csv'); print(len(df)); print(df['score'].describe()); print(df[['ticker','score','rank']].head(10))"`
Expected: 503 rows, no nulls in `score`/`rank` for any row (every company scored, none excluded).

- [ ] **Step 4: Commit**

```bash
git add data/pipeline/09_score.py data/out/sp500_esg_scores.csv
git commit -m "feat: add 09_score.py pipeline stage, run against real S&P 500 dataset"
```

---

## Task 7: Supabase schema and loader

**Files:**
- Modify: `supabase/schema.sql`
- Create: `data/pipeline/10_load_scores.py`

**Interfaces:**
- Consumes: `data/out/sp500_esg_scores.csv` (Task 6).
- Produces: `public.sp500_esg_scores` Supabase table, populated. Consumed by Task 8 (leaderboard), Task 9 (sector view), Task 10 (company detail).

- [ ] **Step 1: Append the new table to `supabase/schema.sql`**

```sql
-- sp500_esg_scores: entropy-weighted TOPSIS sustainability score (0-100)
-- and rank for every S&P 500 constituent, computed by
-- data/pipeline/09_score.py per sustainability-evaluator-blueprint-v1.4.
-- Public reference data, not per-user -- loaded via service role,
-- read-only for regular clients. Every company is scored and ranked;
-- none are excluded for missing data (imputed silently with a sector
-- median and a small disclosure penalty -- see score_engine.py). No
-- column here indicates which values were imputed, by design.
create table public.sp500_esg_scores (
  ticker text primary key,
  company_name text not null,
  sector text not null,
  sub_industry text not null,
  score double precision not null,
  rank integer not null,
  sector_rank integer not null,
  d_plus double precision not null,
  d_minus double precision not null,
  weight_env_intensity double precision not null,
  weight_esg_risk double precision not null,
  weight_controversy double precision not null,
  weight_asset_turnover double precision not null,
  weight_profit_margin double precision not null,
  weight_fcf_margin double precision not null,
  weight_leverage double precision not null,
  contrib_env_intensity double precision not null,
  contrib_esg_risk double precision not null,
  contrib_controversy double precision not null,
  contrib_asset_turnover double precision not null,
  contrib_profit_margin double precision not null,
  contrib_fcf_margin double precision not null,
  contrib_leverage double precision not null,
  env_intensity_raw double precision,
  esg_risk_raw double precision,
  controversy_raw double precision,
  asset_turnover_raw double precision,
  profit_margin_raw double precision,
  fcf_margin_raw double precision,
  leverage_raw double precision,
  updated_at timestamptz not null default now()
);

alter table public.sp500_esg_scores enable row level security;

create policy "public read access" on public.sp500_esg_scores
  for select to authenticated, anon
  using (true);
```

- [ ] **Step 2: Create `10_load_scores.py`, modelled on `07_load_supabase.py`**

```python
"""
Loads data/out/sp500_esg_scores.csv into the public.sp500_esg_scores
table (see supabase/schema.sql) via a direct Postgres connection (upsert
on ticker, so it's safe to re-run).

Requires the table to already exist -- run the CREATE TABLE block in
supabase/schema.sql once via the SQL Editor first.

Usage:
  PGHOST=... PGPORT=5432 PGUSER=postgres.<project-ref> PGPASSWORD=... PGDATABASE=postgres python 10_load_scores.py
"""
import math
import os
import sys

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

CSV_PATH = "../out/sp500_esg_scores.csv"
TABLE = "sp500_esg_scores"
BATCH_SIZE = 100


def clean_value(v):
    if isinstance(v, float) and math.isnan(v):
        return None
    return v


def main():
    required = ["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE"]
    missing = [v for v in required if not os.environ.get(v)]
    if missing:
        print(f"Set environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(CSV_PATH)
    cols = list(df.columns)
    rows = [
        tuple(clean_value(v) for v in row)
        for row in df.itertuples(index=False, name=None)
    ]

    conn = psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ["PGPORT"], user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"], dbname=os.environ["PGDATABASE"], connect_timeout=15,
    )
    cur = conn.cursor()

    col_list = ", ".join(cols)
    update_cols = [c for c in cols if c != "ticker"]
    update_clause = ", ".join(f"{c} = excluded.{c}" for c in update_cols)
    sql = (
        f"insert into public.{TABLE} ({col_list}) values %s "
        f"on conflict (ticker) do update set {update_clause}"
    )

    n_batches = math.ceil(len(rows) / BATCH_SIZE)
    for i in range(n_batches):
        batch = rows[i * BATCH_SIZE:(i + 1) * BATCH_SIZE]
        execute_values(cur, sql, batch)
        print(f"Batch {i + 1}/{n_batches} upserted ({len(batch)} rows)")

    conn.commit()

    cur.execute(f"select count(*) from public.{TABLE};")
    print(f"Done: {cur.fetchone()[0]} rows in {TABLE}")
    conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run the CREATE TABLE block, then the loader**

Run the new `create table public.sp500_esg_scores ...` block (Step 1) once via the Supabase SQL Editor, matching how `sp500_esg_zscores` was originally created (see `supabase/schema.sql`'s existing pattern).

Run: `cd data/pipeline && PGHOST=... PGPORT=5432 PGUSER=postgres.<project-ref> PGPASSWORD=... PGDATABASE=postgres python 10_load_scores.py`
Expected: `Done: 503 rows in sp500_esg_scores`

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql data/pipeline/10_load_scores.py
git commit -m "feat: add sp500_esg_scores Supabase table and loader"
```

---

## Task 8: Universal leaderboard page

**Files:**
- Create: `app/leaderboard/page.tsx`
- Create: `components/leaderboard-table.tsx`

**Interfaces:**
- Consumes: `public.sp500_esg_scores` (Task 7) via `createClient` from `@/lib/supabase/server`.
- Produces: `LeaderboardTable` component (`{ rows: ScoreRow[]; sectorFilter?: string }` props), a `ScoreRow` type re-used by Task 9 and Task 10.

- [ ] **Step 1: Create the leaderboard table component**

```tsx
// components/leaderboard-table.tsx
import Link from "next/link";

import { Badge } from "@/components/ui/badge";

export type ScoreRow = {
  ticker: string;
  company_name: string;
  sector: string;
  score: number;
  rank: number;
  sector_rank: number;
  weight_env_intensity: number;
  weight_esg_risk: number;
  weight_controversy: number;
  weight_asset_turnover: number;
  weight_profit_margin: number;
  weight_fcf_margin: number;
  weight_leverage: number;
};

export function pillarShares(row: Pick<ScoreRow,
  | "weight_env_intensity"
  | "weight_esg_risk"
  | "weight_controversy"
  | "weight_asset_turnover"
  | "weight_profit_margin"
  | "weight_fcf_margin"
  | "weight_leverage"
>) {
  const environmental = row.weight_env_intensity;
  const social = row.weight_esg_risk + row.weight_controversy;
  const financial = row.weight_asset_turnover + row.weight_profit_margin + row.weight_fcf_margin + row.weight_leverage;
  return { environmental, social, financial };
}

export function LeaderboardTable({ rows, useSectorRank = false }: { rows: ScoreRow[]; useSectorRank?: boolean }) {
  return (
    <div className="w-full overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Ticker</th>
            <th className="px-3 py-2 text-left">Company</th>
            <th className="px-3 py-2 text-left">Sector</th>
            <th className="px-3 py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.ticker} className="hover:bg-accent">
              <td className="px-3 py-2 font-mono">{useSectorRank ? row.sector_rank : row.rank}</td>
              <td className="px-3 py-2">
                <Link href={`/leaderboard/${row.ticker}`}>
                  <Badge>{row.ticker}</Badge>
                </Link>
              </td>
              <td className="px-3 py-2">{row.company_name}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.sector}</td>
              <td className="px-3 py-2 text-right font-semibold">{row.score.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the leaderboard page (server component)**

```tsx
// app/leaderboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboard-table";

const SCORE_COLUMNS =
  "ticker, company_name, sector, score, rank, sector_rank, weight_env_intensity, weight_esg_risk, weight_controversy, weight_asset_turnover, weight_profit_margin, weight_fcf_margin, weight_leverage";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select(SCORE_COLUMNS)
    .order("rank", { ascending: true });

  if (error) console.error(error);
  const rows = (data ?? []) as ScoreRow[];

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">Sustainability Leaderboard</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} S&P 500 companies, ranked by sustainability score (0-100).
      </p>
      <LeaderboardTable rows={rows} />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify against the running dev server**

Run: `npm run dev`
Visit `http://localhost:3000/leaderboard` in a browser. Expected: a table of 503 companies sorted by rank descending score, no rows missing (confirms the no-exclusion requirement end-to-end), no visible mention of imputation/missing data anywhere on the page.

- [ ] **Step 4: Commit**

```bash
git add app/leaderboard/page.tsx components/leaderboard-table.tsx
git commit -m "feat: add universal sustainability leaderboard page"
```

---

## Task 9: Sector view

**Files:**
- Create: `app/leaderboard/sector/[sector]/page.tsx`
- Modify: `app/leaderboard/page.tsx`

**Interfaces:**
- Consumes: `LeaderboardTable`, `ScoreRow` (Task 8), same `public.sp500_esg_scores` table.
- Produces: a sector-filtered page reusing the exact same query pattern and rendering component as the universal view, per blueprint section 9 ("filters the universal leaderboard down to the companies in the selected GICS sector, and renumbers the filtered list ... no separate weight vector is fitted").

- [ ] **Step 1: Add sector links to the universal leaderboard page**

```tsx
// app/leaderboard/page.tsx -- add above the closing </main>, after <LeaderboardTable rows={rows} />
import Link from "next/link";

const SECTORS = [...new Set(rows.map((r) => r.sector))].sort();
```

```tsx
// then, inside the returned JSX, after <LeaderboardTable rows={rows} />
<div className="flex flex-wrap gap-2">
  {SECTORS.map((sector) => (
    <Link
      key={sector}
      href={`/leaderboard/sector/${encodeURIComponent(sector)}`}
      className="text-sm underline text-muted-foreground hover:text-foreground"
    >
      {sector}
    </Link>
  ))}
</div>
```

- [ ] **Step 2: Create the sector view page**

```tsx
// app/leaderboard/sector/[sector]/page.tsx
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LeaderboardTable, type ScoreRow } from "@/components/leaderboard-table";

const SCORE_COLUMNS =
  "ticker, company_name, sector, score, rank, sector_rank, weight_env_intensity, weight_esg_risk, weight_controversy, weight_asset_turnover, weight_profit_margin, weight_fcf_margin, weight_leverage";

export default async function SectorLeaderboardPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;
  const decodedSector = decodeURIComponent(sector);

  const supabase = await createClient();
  // Same table, same weights, same scores as the universal view -- this
  // is a filter + renumber (order by sector_rank, which 09_score.py
  // already computed from the universal ranking), never a second
  // weighting pass. Blueprint section 9.
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select(SCORE_COLUMNS)
    .eq("sector", decodedSector)
    .order("sector_rank", { ascending: true });

  if (error) console.error(error);
  const rows = (data ?? []) as ScoreRow[];
  if (rows.length === 0) notFound();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold">{decodedSector}</h1>
      <p className="text-sm text-muted-foreground">
        {rows.length} companies in this sector, same scores and weights as the universal leaderboard -- just filtered and renumbered.
      </p>
      <LeaderboardTable rows={rows} useSectorRank />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`
Visit `/leaderboard`, click a sector link (e.g. Utilities). Expected: only that sector's companies, numbered 1..N by `sector_rank`, and (spot check) the same company's score value matches what's shown on the universal `/leaderboard` page for that ticker.

- [ ] **Step 4: Commit**

```bash
git add app/leaderboard/page.tsx "app/leaderboard/sector/[sector]/page.tsx"
git commit -m "feat: add sector-filtered view of the universal leaderboard"
```

---

## Task 10: Company detail panel — decomposition, weight vector, generated explanation

**Files:**
- Create: `app/leaderboard/[ticker]/page.tsx`
- Create: `components/company-detail.tsx`

**Interfaces:**
- Consumes: full row from `public.sp500_esg_scores` (Task 7), including `contrib_*`, `*_raw` — but never any imputed-flag column, because none exists in the table (Task 7), and never `rank_min`/`rank_max`, because rank stability was dropped (Global Constraints amendment).
- Produces: `CompanyDetail` component rendering the per-axis decomposition bar, weight vector, pillar shares, and a generated plain-language explanation paragraph, per blueprint section 10 (minus the rank-stability display).

- [ ] **Step 1: Create the company detail component**

```tsx
// components/company-detail.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AXES = [
  { key: "env_intensity", label: "Emissions intensity" },
  { key: "esg_risk", label: "ESG risk score" },
  { key: "controversy", label: "Controversy level" },
  { key: "asset_turnover", label: "Asset turnover" },
  { key: "profit_margin", label: "Net margin" },
  { key: "fcf_margin", label: "FCF margin" },
  { key: "leverage", label: "Net debt / EBITDA" },
] as const;

export type CompanyDetailRow = {
  ticker: string;
  company_name: string;
  sector: string;
  score: number;
  rank: number;
  sector_rank: number;
} & {
  [K in (typeof AXES)[number]["key"] as `weight_${K}`]: number;
} & {
  [K in (typeof AXES)[number]["key"] as `contrib_${K}`]: number;
};

function generateExplanation(row: CompanyDetailRow): string {
  const sorted = [...AXES].sort(
    (a, b) => row[`contrib_${b.key}`] - row[`contrib_${a.key}`],
  );
  const costliest = sorted.slice(0, 2).map((a) => a.label);
  const closest = sorted[sorted.length - 1].label;
  return `${row.company_name}'s distance from the ideal is driven mostly by ${costliest.join(" and ")}. It sits closest to the frontier on ${closest}.`;
}

export function CompanyDetail({ row }: { row: CompanyDetailRow }) {
  const environmental = row.weight_env_intensity;
  const social = row.weight_esg_risk + row.weight_controversy;
  const financial =
    row.weight_asset_turnover + row.weight_profit_margin + row.weight_fcf_margin + row.weight_leverage;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{row.score.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              Rank {row.rank} overall / {row.sector_rank} in {row.sector}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{generateExplanation(row)}</p>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-1">
              Distance-to-ideal decomposition
            </div>
            <div className="flex flex-col gap-1">
              {AXES.map((axis) => {
                const contrib = row[`contrib_${axis.key}`];
                return (
                  <div key={axis.key} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 text-muted-foreground">{axis.label}</span>
                    <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(contrib * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right">{(contrib * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Pillar weight shares: Environmental {(environmental * 100).toFixed(0)}%, Social{" "}
            {(social * 100).toFixed(0)}%, Financial/Operational {(financial * 100).toFixed(0)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create the detail page (server component)**

```tsx
// app/leaderboard/[ticker]/page.tsx
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { CompanyDetail, type CompanyDetailRow } from "@/components/company-detail";

const DETAIL_COLUMNS =
  "ticker, company_name, sector, score, rank, sector_rank, weight_env_intensity, weight_esg_risk, weight_controversy, weight_asset_turnover, weight_profit_margin, weight_fcf_margin, weight_leverage, contrib_env_intensity, contrib_esg_risk, contrib_controversy, contrib_asset_turnover, contrib_profit_margin, contrib_fcf_margin, contrib_leverage";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sp500_esg_scores")
    .select(DETAIL_COLUMNS)
    .eq("ticker", ticker.toUpperCase())
    .maybeSingle();

  if (error) console.error(error);
  if (!data) notFound();

  return (
    <main className="min-h-screen flex flex-col gap-6 px-5 py-16 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold">
        {data.company_name} <span className="text-muted-foreground font-mono text-xl">{data.ticker}</span>
      </h1>
      <CompanyDetail row={data as CompanyDetailRow} />
    </main>
  );
}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`
Visit `/leaderboard`, click a ticker badge. Expected: score, rank, decomposition bars summing to ~100%, pillar shares, and a generated sentence — nothing on the page mentions "imputed," "missing," or "estimated" for any company, including one of the 93 known-imputed tickers (e.g. spot-check a ticker confirmed missing environmental+social data in the original CSV).

- [ ] **Step 4: Commit**

```bash
git add "app/leaderboard/[ticker]/page.tsx" components/company-detail.tsx
git commit -m "feat: add company detail page with distance decomposition and generated explanation"
```

---

## Self-Review Notes

- **Spec coverage:** section 3 (TOPSIS+entropy model) → Tasks 3-4; section 5 (direction) → Task 1; section 6 (reference ranges, imputation, penalty — minus the two agreed exclusions/flag removals) → Tasks 1-2; section 7/7.1 (entropy + all 5 guardrails, binary-variable guardrail correctly out of scope since the confirmed set has no binary variables) → Task 3; section 8 (scoring + decomposition) → Task 4; section 9 (universal/sector view as one computation) → Tasks 8-9; section 10 (leaderboard, detail view, weight-vs-equal, generated paragraph — rank stability deliberately dropped, see Global Constraints amendment) → Tasks 8, 5, 10; section 11 (confirmed variable set + real data sources) → Task 1's `RAW_COLUMNS`; section 12 (worked example) → used as unit-test ground truth throughout; section 15 (build order) → this plan's task ordering.
- **Not in scope for this plan** (not required by the user's request, flagged rather than silently dropped): CRITIC fallback implementation (decided not needed on real data, see `score_engine.py` docstring — implement only if a future data refresh makes entropy weights lopsided); "excluded companies" list UI (deliberately removed per Global Constraint 1); any imputed-value flag or badge in the UI (deliberately removed per Global Constraint 2).
