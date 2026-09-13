"""Utility generation-mix extraction in 16_segment_notes.py (spec D5/D7 fix): 29 of 31 utilities
came back not-found because find_sections rarely located the real disclosure table (fixed in
nzlib/edgar.py) and the mix loop always re-ran the untagged-segment-notes loop too. Covers the
extract_mix() unit and the --mix-only flag that skips the unrelated notes loop."""
import importlib.util
import json
from pathlib import Path

import pandas as pd
import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "16_segment_notes.py"


def load_module():
    spec = importlib.util.spec_from_file_location("segment_notes_script", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_extract_mix_returns_not_found_without_calling_gemini_when_no_excerpts():
    module = load_module()

    def gemini(prompt, schema):
        raise AssertionError("gemini should not be called with no excerpts")

    row = module.extract_mix(gemini, "Acme Power", "no fuel disclosure anywhere in this filing")
    assert row["status"] == "not-found"
    assert row["fossil_share"] is None


def test_extract_mix_extracted_when_shares_are_valid(monkeypatch):
    module = load_module()
    text = "Fuel Supply generation sources by type: Coal 43% Nuclear 19% Natural Gas 22% Renewables 16%"

    def gemini(prompt, schema):
        assert "Acme Power" in prompt
        return {
            "found": True,
            "fossil_share": 0.65,
            "renewable_share": 0.16,
            "nuclear_share": 0.19,
            "basis": "owned_generation_mwh",
            "quote": "Coal 43% Nuclear 19% Natural Gas 22% Renewables 16%",
        }

    row = module.extract_mix(gemini, "Acme Power", text)
    assert row["status"] == "extracted"
    assert row["fossil_share"] == 0.65
    assert row["basis"] == "owned_generation_mwh"


def test_extract_mix_falls_back_to_not_found_when_shares_sum_too_high():
    # e.g. shares given in MW-vs-% confusion, or a holding-company aggregation double-counting a
    # subsidiary -- the sum check is the safety net for a bad extraction, not just a missing one.
    module = load_module()
    text = "Fuel Supply generation sources by type: Coal 143% Nuclear 90% Natural Gas 80%"

    def gemini(prompt, schema):
        return {
            "found": True,
            "fossil_share": 1.43,
            "renewable_share": 0.9,
            "nuclear_share": 0.8,
            "basis": "capacity_mw",
            "quote": "bad data",
        }

    row = module.extract_mix(gemini, "Acme Power", text)
    assert row["status"] == "not-found"


def test_extract_mix_falls_back_to_not_found_when_gemini_says_not_found():
    module = load_module()
    text = "Fuel Supply generation sources by type: mentions coal but no numbers 43%"

    def gemini(prompt, schema):
        return {"found": False, "fossil_share": 0, "renewable_share": 0, "nuclear_share": 0, "basis": "other", "quote": ""}

    row = module.extract_mix(gemini, "Acme Power", text)
    assert row["status"] == "not-found"


def test_mix_only_flag_skips_notes_loop_and_leaves_existing_note_files_untouched(tmp_path, monkeypatch, capsys):
    module = load_module()
    module.OUT_DIR = tmp_path
    module.CACHE_DIR = tmp_path / "gemini_cache"
    module.UNIVERSE_PATH = tmp_path / "universe.csv"

    pd.DataFrame(
        [{"ticker": "ABC", "company_name": "Abc Utility", "sector": "Utilities"}]
    ).to_csv(module.UNIVERSE_PATH, index=False)
    # Pre-existing outputs from a prior full run -- must survive a --mix-only run untouched.
    existing_notes = pd.DataFrame([{"ticker": "XYZ", "member": "Segment A", "revenue": 1.0, "fiscal_year": 2025,
                                     "filing_url": "u", "quote": "q"}])
    existing_notes.to_csv(tmp_path / "segment_notes.csv", index=False)
    pd.DataFrame([{"ticker": "XYZ", "status": "extracted"}]).to_csv(tmp_path / "note_status.csv", index=False)

    class FakeSec:
        def cik_map(self):
            return {"ABC": 1}

        def submissions(self, cik):
            return {"filings": {"recent": {"form": ["10-K"], "accessionNumber": ["0000000000-25-000001"],
                                            "primaryDocument": ["abc.htm"], "reportDate": ["2025-12-31"]}}}

        def get(self, url):
            class R:
                text = "<p>Fuel Supply generation sources by type: Coal 43% Nuclear 19% Natural Gas 22% Renewables 16%</p>"
            return R()

    monkeypatch.setattr(module, "client_from_env", lambda: FakeSec())
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    def fake_generate(api_key):
        def generate(model, prompt, schema):
            return json.dumps({"found": True, "fossil_share": 0.65, "renewable_share": 0.16,
                                "nuclear_share": 0.19, "basis": "owned_generation_mwh", "quote": "q"})
        return generate

    monkeypatch.setattr(module, "google_generate", fake_generate)
    monkeypatch.setattr("sys.argv", ["16_segment_notes.py", "--mix-only"])

    module.main()
    capsys.readouterr()

    # Notes loop never ran: files from the earlier run are byte-for-byte unchanged.
    pd.testing.assert_frame_equal(pd.read_csv(tmp_path / "segment_notes.csv"), existing_notes)
    assert pd.read_csv(tmp_path / "note_status.csv")["ticker"].tolist() == ["XYZ"]

    mix = pd.read_csv(tmp_path / "generation_mix.csv").set_index("ticker")
    assert mix.loc["ABC", "status"] == "extracted"
    assert mix.loc["ABC", "fossil_share"] == pytest.approx(0.65)
