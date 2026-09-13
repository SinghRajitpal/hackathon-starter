import pytest

from nzlib import fleet


def test_fuel_to_tco2e_uses_epa_factors():
    assert fleet.fuel_to_tco2e([{"fuel": "jet_fuel", "quantity": 1, "unit": "million_gallons"}]) == pytest.approx(9750.0)
    assert fleet.fuel_to_tco2e([{"fuel": "diesel", "quantity": 100, "unit": "barrels"}]) == pytest.approx(42.882)


def test_cng_must_be_in_standard_cubic_feet():
    assert fleet.fuel_to_tco2e([{"fuel": "cng", "quantity": 1000, "unit": "scf"}]) == pytest.approx(0.05444)
    with pytest.raises(ValueError):
        fleet.fuel_to_tco2e([{"fuel": "cng", "quantity": 1, "unit": "gallons"}])


def test_fuel_to_tco2e_supports_marine_metric_tons_for_hfo_and_mgo():
    # Cruise lines (CCL, RCL, NCLH) report bunker fuel consumption in metric tons, not gallons --
    # the pre-fix unit list had no mass unit at all, so these tickers could never be extracted.
    # Factors are the EPA per-gallon Table 2 figures above converted with ISO 8217 marine fuel
    # densities (see nzlib/fleet.py comment); cross-checked against IMO's Cf carbon factors
    # (HFO 3.114, MGO 3.206 t CO2/t) within ~4%.
    assert fleet.fuel_to_tco2e([{"fuel": "residual_fuel_oil", "quantity": 1, "unit": "metric_tons"}]) == pytest.approx(
        3.004257, rel=1e-5
    )
    assert fleet.fuel_to_tco2e([{"fuel": "diesel", "quantity": 1, "unit": "metric_tons"}]) == pytest.approx(
        3.136275, rel=1e-5
    )


def test_fuel_to_tco2e_supports_million_metric_tons():
    # e.g. Carnival's 10-K: "Fuel consumption in metric tons (in millions) 2.8".
    result = fleet.fuel_to_tco2e([{"fuel": "residual_fuel_oil", "quantity": 2.8, "unit": "million_metric_tons"}])
    assert result == pytest.approx(2.8e6 * 3.004257, rel=1e-5)


def test_fuel_to_tco2e_metric_tons_requires_a_known_marine_fuel():
    with pytest.raises(ValueError):
        fleet.fuel_to_tco2e([{"fuel": "jet_fuel", "quantity": 1, "unit": "metric_tons"}])
