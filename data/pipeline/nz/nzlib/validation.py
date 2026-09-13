"""PDF §11 validation inputs: FY2019 financials from SEC companyfacts and emissions-intensity change."""
from datetime import date

REVENUE_TAGS = [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RegulatedAndUnregulatedOperatingRevenue",
    "SalesRevenueNet",
]
OPERATING_INCOME_TAGS = ["OperatingIncomeLoss"]
DEPRECIATION_TAGS = [
    "DepreciationDepletionAndAmortization",
    "DepreciationAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
]


def annual_value(facts: dict, tags: list[str], fiscal_year_end_year: int) -> float | None:
    """First tag with a full-year USD fact (330–400 days) ending in the given calendar year."""
    usgaap = facts.get("facts", {}).get("us-gaap", {})
    for tag in tags:
        for fact in usgaap.get(tag, {}).get("units", {}).get("USD", []):
            start, end = fact.get("start"), fact.get("end")
            if not start or not end or int(end[:4]) != fiscal_year_end_year:
                continue
            days = (date.fromisoformat(end) - date.fromisoformat(start)).days
            if 330 <= days <= 400:
                return float(fact["val"])
    return None


def ebitda(facts: dict, year: int) -> float | None:
    operating_income = annual_value(facts, OPERATING_INCOME_TAGS, year)
    depreciation = annual_value(facts, DEPRECIATION_TAGS, year)
    if operating_income is None or depreciation is None:
        return None
    return operating_income + depreciation


def intensity(emissions: float | None, revenue: float | None) -> float | None:
    if emissions is None or revenue is None or revenue <= 0:
        return None
    return emissions / revenue


def intensity_change(intensity_2019: float | None, intensity_latest: float | None) -> float | None:
    if intensity_2019 is None or intensity_latest is None or intensity_2019 <= 0:
        return None
    return intensity_latest / intensity_2019 - 1.0
