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


def fuel_to_tco2e(fuels: list[dict]) -> float:
    """fuels: [{"fuel": key of KG_CO2_PER_GALLON or "cng", "quantity": float, "unit": "gallons"|"million_gallons"|"barrels"|"scf"}]."""
    total_kg = 0.0
    for f in fuels:
        quantity = float(f["quantity"])
        if f["fuel"] == "cng":
            if f["unit"] != "scf":
                raise ValueError(f"CNG must be in scf, got {f['unit']}")
            total_kg += quantity * KG_CO2_PER_SCF_CNG
            continue
        total_kg += quantity * GALLONS_PER_UNIT[f["unit"]] * KG_CO2_PER_GALLON[f["fuel"]]
    return total_kg / 1000.0
