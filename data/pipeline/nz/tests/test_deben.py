import pytest

from nzlib import deben


def test_de_ben_from_labels_and_generation_mix():
    segs = [
        {"revenue": 50, "label": "exposed"},
        {"revenue": 30, "label": "electricity_generation"},
        {"revenue": 20, "label": "beneficiary"},
    ]
    out = deben.de_ben(segs, {"fossil_share": 0.5, "renewable_share": 0.3})
    assert out["de"] == pytest.approx(0.65)
    assert out["ben"] == pytest.approx(0.29)
    assert deben.de_ben(segs, None)["needs_generation_mix"] is True
    assert deben.de_ben([], None)["de"] is None
