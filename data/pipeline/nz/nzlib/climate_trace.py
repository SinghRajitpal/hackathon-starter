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


def attribute(source: dict, owners: list[dict], company_owner_ids: set[str]) -> tuple[str, float] | None:
    """One Climate TRACE source → (category, tCO2e attributed to the company) or None.

    `source` is a row from /v7/sources (subsector, country, emissionsQuantity);
    `owners` is the owner list from /v7/sources/:id.
    """
    category = SUBSECTOR_CATEGORY.get(source.get("subsector", ""))
    if category is None or source.get("country") == US_COUNTRY_CODE:
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
