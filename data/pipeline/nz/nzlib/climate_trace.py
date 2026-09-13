"""Climate TRACE v7 asset attribution (spec D10, D13)."""
from collections import defaultdict

SUBSECTOR_CATEGORY = {
    # combustion
    "electricity-generation": "combustion",
    "heat-plants": "combustion",
    "non-residential-onsite-fuel-usage": "combustion",
    "other-onsite-fuel-usage": "combustion",
    "residential-onsite-fuel-usage": "combustion",
    "other-energy-use": "combustion",
    # fleet
    "domestic-aviation": "fleet",
    "international-aviation": "fleet",
    "domestic-shipping": "fleet",
    "international-shipping": "fleet",
    "railways": "fleet",
    "road-transportation": "fleet",
    "other-transport": "fleet",
    "non-broadcasting-vessels": "fleet",
    # process
    "aluminum": "process",
    "cement": "process",
    "chemicals": "process",
    "other-chemicals": "process",
    "petrochemical-steam-cracking": "process",
    "oil-and-gas-refining": "process",
    "iron-and-steel": "process",
    "lime": "process",
    "glass": "process",
    "pulp-and-paper": "process",
    "other-manufacturing": "process",
    "other-metals": "process",
    "food-beverage-tobacco": "process",
    "textiles-leather-apparel": "process",
    "wood-and-wood-products": "process",
    # fugitive
    "oil-and-gas-production": "fugitive",
    "oil-and-gas-transport": "fugitive",
    "coal-mining": "fugitive",
    "other-fossil-fuel-operations": "fugitive",
    "other-solid-fuels": "fugitive",
    "solid-waste-disposal": "fugitive",
    "industrial-wastewater-treatment-and-discharge": "fugitive",
    "domestic-wastewater-treatment-and-discharge": "fugitive",
    "fluorinated-gases": "fugitive",
    "bauxite-mining": "fugitive",
    "copper-mining": "fugitive",
    "iron-mining": "fugitive",
    "other-mining-quarrying": "fugitive",
    "rock-quarrying": "fugitive",
    "sand-quarrying": "fugitive",
}

US_COUNTRY_CODE = "USA"
# GHGRP already covers US territories, so Climate TRACE must treat them as US too (else e.g. AES
# Puerto Rico gets counted twice: once via GHGRP, once via Climate TRACE's "non-US" bucket).
US_COUNTRY_CODES = frozenset({US_COUNTRY_CODE, "PRI", "GUM", "VIR", "ASM", "MNP"})

# oil-and-gas-production / oil-and-gas-transport are the only subsectors where Climate TRACE
# publishes country-basin aggregates (e.g. "Qatar_Rub al Khali_LNG") rather than single assets.
BASIN_AGGREGATE_SUBSECTORS = frozenset({"oil-and-gas-production", "oil-and-gas-transport"})


def is_basin_aggregate(name: str | None) -> bool:
    """True for a Climate TRACE country-basin aggregate name: `Country_Basin_Type`, exactly three
    non-empty underscore-separated segments (e.g. "Qatar_Rub al Khali_LNG", "Saudi Arabia_Widyan -
    North Arabian Gulf_Conventional onshore"). These aggregate many wells/fields under one row, so
    they are not a single verified owned asset -- spec D13's equal split assumes the latter. Real
    Climate TRACE asset names in this dataset use spaces, commas or hyphens, never underscores.
    """
    if not name:
        return False
    parts = name.split("_")
    return len(parts) == 3 and all(p.strip() for p in parts)


def attribute(source: dict, owners: list[dict], company_owner_ids: set[str]) -> tuple[str, float] | None:
    """One Climate TRACE source → (category, tCO2e attributed to the company) or None.

    `source` is a row from /v7/sources (subsector, country, emissionsQuantity);
    `owners` is the owner list from /v7/sources/:id.
    """
    category = SUBSECTOR_CATEGORY.get(source.get("subsector", ""))
    if category is None or source.get("country") in US_COUNTRY_CODES:
        return None
    if source.get("subsector") in BASIN_AGGREGATE_SUBSECTORS and is_basin_aggregate(source.get("name")):
        return None
    distinct = {o["id"] for o in owners}
    ours = distinct & company_owner_ids
    if not ours:
        return None
    return category, float(source.get("emissionsQuantity") or 0.0) * len(ours) / len(distinct)


def aggregate(attributions: list[tuple[str, float] | None]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for item in attributions:
        if item is not None:
            totals[item[0]] += item[1]
    return dict(totals)
