"""Assemble per-ticker Scope 1 emissions by PDF §4 source category (spec D10, D11, D13, D14)."""
import math

from nzlib.impute import split_wikirate_total

SCOPE1_CATEGORIES = ["combustion", "fleet", "process", "fugitive"]
GHGRP_CATEGORIES = ["combustion", "process", "fugitive"]
NO_PEER_SHARES = {"combustion": 1.0, "process": 0.0, "fugitive": 0.0}
# Ruling (progress.md, P1 pre-flight): the tautological "categories sum to total" check is replaced by
# a per-ticker reconciliation of GHGRP's own reported_total against the category split, 2023 rows only.
GHGRP_RECONCILIATION_THRESHOLD = 0.005


def present(value) -> float | None:
    """float(value), or None for missing / NaN / unparsable."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(number) else number


def merge_emissions(
    ghgrp: dict | None,
    ct: dict | None,
    fleet_tco2e,
    scope1_total,
    scope1_source: str | None,
    sector_shares: dict | None,
) -> tuple[dict, list[str], list[tuple[str, str, float]]]:
    """Returns (categories, flags, sources).

    Priority: GHGRP split (+ Climate TRACE non-US, + 10-K fleet) → reported Scope 1 total split by
    sector-median shares with fleet first (no Climate TRACE, avoids double counting) → Climate TRACE
    only (+ fleet) → fleet only → nothing (all None).
    """
    categories: dict[str, float | None] = {c: None for c in SCOPE1_CATEGORIES}
    flags: list[str] = []
    sources: list[tuple[str, str, float]] = []
    fleet = present(fleet_tco2e)
    total = present(scope1_total)

    def add(category: str, value: float | None, source: str) -> None:
        if value is None:
            return
        categories[category] = (categories[category] or 0.0) + value
        sources.append((source, category, value))

    def add_ct() -> None:
        for category, value in (ct or {}).items():
            add(category, present(value), "ClimateTRACE")
        flags.append("ct-equal-split")

    if ghgrp is not None:
        for category in GHGRP_CATEGORIES:
            add(category, present(ghgrp.get(category)) or 0.0, "GHGRP")
        if ct:
            add_ct()
        add("fleet", fleet, "10-K fleet")
    elif total is not None:
        shares = sector_shares
        if shares is None:
            shares = NO_PEER_SHARES
            flags.append("category-split-no-peers")
        split = split_wikirate_total(total, fleet, shares)
        for category, value in split.items():
            source = "10-K fleet" if category == "fleet" and fleet is not None else (scope1_source or "Wikirate/GRI")
            add(category, value, source)
        flags.append("category-split-imputed")
    elif ct:
        add_ct()
        add("fleet", fleet, "10-K fleet")
    elif fleet is not None:
        add("fleet", fleet, "10-K fleet")
        flags.append("scope1-fleet-only")
    return categories, flags, sources


def ghgrp_reconciliation_exceptions(
    rows: list[dict], threshold: float = GHGRP_RECONCILIATION_THRESHOLD
) -> list[str]:
    """Tickers where |reported_total - total| / reported_total exceeds `threshold` (default 0.5%).

    `rows` are ghgrp_categories.csv records (one year) with `ticker`, `total` (sum of categories) and
    `reported_total` (EPA's own total, may be absent on older data). Rows with a missing or zero
    reported_total are skipped — there is nothing meaningful to divide by.
    """
    exceptions = []
    for row in rows:
        reported = present(row.get("reported_total"))
        total = present(row.get("total"))
        if not reported or total is None:
            continue
        if abs(reported - total) / abs(reported) > threshold:
            exceptions.append(row["ticker"])
    return exceptions
