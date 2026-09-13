import pytest

from nzlib import fleet


def test_fuel_to_tco2e_uses_epa_factors():
    assert fleet.fuel_to_tco2e([{"fuel": "jet_fuel", "quantity": 1, "unit": "million_gallons"}]) == pytest.approx(9750.0)
    assert fleet.fuel_to_tco2e([{"fuel": "diesel", "quantity": 100, "unit": "barrels"}]) == pytest.approx(42.882)


def test_cng_must_be_in_standard_cubic_feet():
    assert fleet.fuel_to_tco2e([{"fuel": "cng", "quantity": 1000, "unit": "scf"}]) == pytest.approx(0.05444)
    with pytest.raises(ValueError):
        fleet.fuel_to_tco2e([{"fuel": "cng", "quantity": 1, "unit": "gallons"}])
