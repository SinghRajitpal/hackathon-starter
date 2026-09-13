"""--recap-only path of 10_ttm_financials.py (D16 fix): re-apply the listed-line float cap to an
already-fetched CSV with no yfinance calls, idempotently."""
import importlib.util
from pathlib import Path

import pandas as pd

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "10_ttm_financials.py"


def load_module(out_path: Path):
    spec = importlib.util.spec_from_file_location("ttm_financials_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUT_PATH = out_path
    return module


def test_recap_only_caps_multiclass_rows_and_leaves_single_class_rows_alone(tmp_path, capsys):
    out_path = tmp_path / "financials_ttm.csv"
    pd.DataFrame(
        [
            # GOOGL-like: overstated float_cap from a company-wide market cap paired with this
            # class's own shares outstanding (ratio path, no prior flag).
            {
                "ticker": "GOOGL",
                "price": 165.0,
                "shares_outstanding": 5.9e9,
                "float_cap": 4.06e12,
                "cap_flag": None,
                "fetch_error": None,
            },
            # BRK-B-like: already flagged as a market-cap fallback, still needs the listed-line cap.
            {
                "ticker": "BRK-B",
                "price": 480.0,
                "shares_outstanding": 1.3e9,
                "float_cap": 1.05e12,
                "cap_flag": "float-cap-fallback-market-cap",
                "fetch_error": None,
            },
            # Ordinary single-class ticker: listed line is above the existing cap, no change.
            {
                "ticker": "MMM",
                "price": 164.97,
                "shares_outstanding": 515722417.0,
                "float_cap": 84935796383.77986,
                "cap_flag": None,
                "fetch_error": None,
            },
        ]
    ).to_csv(out_path, index=False)

    module = load_module(out_path)
    module.recap_only()
    capsys.readouterr()

    result = pd.read_csv(out_path).set_index("ticker")
    assert result.loc["GOOGL", "float_cap"] == 165.0 * 5.9e9
    assert result.loc["GOOGL", "cap_flag"] == "float-cap-capped-listed-line"
    assert result.loc["BRK-B", "float_cap"] == 480.0 * 1.3e9
    assert result.loc["BRK-B", "cap_flag"] == "float-cap-fallback-market-cap+capped-listed-line"
    assert result.loc["MMM", "float_cap"] == 84935796383.77986
    assert pd.isna(result.loc["MMM", "cap_flag"])


def test_recap_only_is_idempotent(tmp_path):
    out_path = tmp_path / "financials_ttm.csv"
    pd.DataFrame(
        [{"ticker": "GOOGL", "price": 165.0, "shares_outstanding": 5.9e9, "float_cap": 4.06e12, "cap_flag": None, "fetch_error": None}]
    ).to_csv(out_path, index=False)

    module = load_module(out_path)
    module.recap_only()
    first = pd.read_csv(out_path)
    module.recap_only()
    second = pd.read_csv(out_path)

    pd.testing.assert_frame_equal(first, second)
