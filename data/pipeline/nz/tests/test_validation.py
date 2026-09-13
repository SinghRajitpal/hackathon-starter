import pytest

from nzlib import validation

FACTS = {
    "facts": {
        "us-gaap": {
            "OperatingIncomeLoss": {
                "units": {
                    "USD": [
                        {"start": "2019-10-01", "end": "2019-12-31", "val": 1, "form": "10-K"},
                        {"start": "2019-01-01", "end": "2019-12-31", "val": 500, "form": "10-K"},
                    ]
                }
            },
            "DepreciationAndAmortization": {
                "units": {"USD": [{"start": "2019-01-01", "end": "2019-12-31", "val": 200, "form": "10-K"}]}
            },
        }
    }
}


def test_annual_value_skips_quarterly_facts():
    assert validation.annual_value(FACTS, validation.OPERATING_INCOME_TAGS, 2019) == 500.0
    assert validation.annual_value(FACTS, validation.OPERATING_INCOME_TAGS, 2020) is None


def test_ebitda_is_operating_income_plus_depreciation():
    assert validation.ebitda(FACTS, 2019) == 700.0
    assert validation.ebitda({"facts": {}}, 2019) is None


def test_intensity_change():
    assert validation.intensity(100.0, 1000.0) == pytest.approx(0.1)
    assert validation.intensity(100.0, 0) is None
    assert validation.intensity_change(0.1, 0.08) == pytest.approx(-0.2)
    assert validation.intensity_change(None, 0.08) is None
