"""Fleet fuel → tCO2e with EPA GHG Emission Factors Hub 2025, Table 2 (Mobile Combustion CO2)."""

KG_CO2_PER_GALLON = {
    "jet_fuel": 9.75,
    "aviation_gasoline": 8.31,
    "diesel": 10.21,
    "gasoline": 8.78,
    "lpg": 5.68,
    "residual_fuel_oil": 11.27,
}
KG_CO2_PER_SCF_CNG = 0.05444
GALLONS_PER_UNIT = {"gallons": 1.0, "million_gallons": 1e6, "barrels": 42.0}

# Marine bunker fuel (spec fix: fleet coverage bias). Cruise lines (CCL, RCL, NCLH) report fuel
# consumption in metric tons, not gallons -- there was previously no mass unit at all, so these
# tickers could never be extracted even when the 10-K disclosed a number.
#
# The per-metric-ton CO2 factor is derived, not looked up fresh: it is the EPA GHG Emission
# Factors Hub 2025 Table 2 per-gallon factor above (already used for the same fuel) times the
# gallons-per-tonne implied by the fuel's density, so it stays internally consistent with the
# rest of this file rather than importing a second standard's factor.
#   HFO / residual fuel oil: ISO 8217:2017 RMG-grade residual marine fuel, max density
#     991 kg/m^3 (0.991 kg/L) at 15C.
#   MGO / marine gas oil (distillate, mapped to "diesel"): ISO 8217:2017 DMA-grade marine gas
#     oil, typical density 860 kg/m^3 (0.860 kg/L) at 15C.
# Cross-check: this gives ~3.00 tCO2/t (HFO) and ~3.14 tCO2/t (MGO), within ~4% of IMO's
# published carbon conversion factors (MEPC.1/Circ.684: HFO 3.114, Diesel/MGO 3.206 tCO2/t
# fuel) -- close enough to corroborate the derivation; the small gap is expected since the EPA
# factors above are for generic residual/distillate fuel oil rather than the marine-grade cut.
_LITERS_PER_GALLON = 3.785411784
_MARINE_FUEL_DENSITY_KG_PER_L = {"residual_fuel_oil": 0.991, "diesel": 0.860}
KG_CO2_PER_METRIC_TON = {
    fuel: KG_CO2_PER_GALLON[fuel] * (1000.0 / (density * _LITERS_PER_GALLON))
    for fuel, density in _MARINE_FUEL_DENSITY_KG_PER_L.items()
}
METRIC_TONS_PER_UNIT = {"metric_tons": 1.0, "million_metric_tons": 1e6}


def fuel_to_tco2e(fuels: list[dict]) -> float:
    """fuels: [{"fuel": key of KG_CO2_PER_GALLON or "cng", "quantity": float,
    "unit": "gallons"|"million_gallons"|"barrels"|"scf"|"metric_tons"|"million_metric_tons"}]."""
    total_kg = 0.0
    for f in fuels:
        quantity = float(f["quantity"])
        if f["fuel"] == "cng":
            if f["unit"] != "scf":
                raise ValueError(f"CNG must be in scf, got {f['unit']}")
            total_kg += quantity * KG_CO2_PER_SCF_CNG
            continue
        if f["unit"] in METRIC_TONS_PER_UNIT:
            if f["fuel"] not in KG_CO2_PER_METRIC_TON:
                raise ValueError(f"No metric-ton CO2 factor for fuel {f['fuel']!r} (marine fuels only)")
            total_kg += quantity * METRIC_TONS_PER_UNIT[f["unit"]] * KG_CO2_PER_METRIC_TON[f["fuel"]]
            continue
        total_kg += quantity * GALLONS_PER_UNIT[f["unit"]] * KG_CO2_PER_GALLON[f["fuel"]]
    return total_kg / 1000.0
