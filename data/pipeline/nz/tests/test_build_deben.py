import pytest

from nzlib import build


def record(sector, de, ben, status):
    return {"sector": sector, "de": de, "ben": ben, "de_ben_status": status, "flags": []}


def test_median_generation_mix_ignores_missing():
    assert build.median_generation_mix([None]) is None
    mix = build.median_generation_mix(
        [{"fossil_share": 0.2, "renewable_share": 0.5}, None, {"fossil_share": 0.6, "renewable_share": 0.1}]
    )
    assert mix == {"fossil_share": pytest.approx(0.4), "renewable_share": pytest.approx(0.3)}


def test_fill_de_ben_imputes_in_scope_and_zeroes_out_of_scope():
    records = [
        record("Energy", 0.8, 0.0, "tagged"),
        record("Energy", 0.4, 0.2, "note"),
        record("Energy", None, None, "unclassified"),
        record("Utilities", None, None, "unclassified"),
        record("Information Technology", None, None, "unclassified"),
    ]
    build.fill_de_ben(records, {"Energy", "Utilities"})
    assert records[2]["de"] == pytest.approx(0.6) and records[2]["ben"] == pytest.approx(0.1)
    assert records[2]["de_ben_status"] == "imputed" and records[2]["flags"] == ["de-ben-imputed"]
    assert (records[3]["de"], records[3]["ben"], records[3]["de_ben_status"]) == (0.0, 0.0, "imputed")
    assert (records[4]["de"], records[4]["ben"], records[4]["de_ben_status"]) == (0.0, 0.0, "unclassified")
    assert records[4]["flags"] == ["de-ben-out-of-scope-zero"]
    assert records[0]["flags"] == []
