"""Assemble per-ticker Scope 1 emissions by PDF §4 source category (spec D10, D11, D13, D14)."""
import math

from nzlib.impute import split_wikirate_total

SCOPE1_CATEGORIES = ["combustion", "fleet", "process", "fugitive"]
GHGRP_CATEGORIES = ["combustion", "process", "fugitive"]
NO_PEER_SHARES = {"combustion": 1.0, "process": 0.0, "fugitive": 0.0}


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


# ---- DE / BEN filling (P4, spec D5, D7; PDF §15) ----
import statistics  # noqa: E402

MEASURED_DE_BEN_STATUSES = ("tagged", "note")


def median_generation_mix(mixes: list[dict | None]) -> dict | None:
    """Median fossil and renewable shares across utilities that disclosed a generation mix."""
    usable = [m for m in mixes if m is not None]
    if not usable:
        return None
    return {
        "fossil_share": statistics.median(m["fossil_share"] for m in usable),
        "renewable_share": statistics.median(m["renewable_share"] for m in usable),
    }


def fill_de_ben(records: list[dict], in_scope_sectors: set[str]) -> None:
    """Mutates records (keys: sector, de, ben, de_ben_status, flags list).

    Out-of-scope sectors → DE = BEN = 0, unclassified (PDF §15 default).
    In-scope without a measured value → sector median of measured values, imputed (PDF §5).
    """
    medians: dict[str, tuple[float, float]] = {}
    for sector in {r["sector"] for r in records}:
        measured = [r for r in records if r["sector"] == sector and r["de_ben_status"] in MEASURED_DE_BEN_STATUSES]
        if measured:
            de = statistics.median(r["de"] for r in measured)
            ben = statistics.median(r["ben"] for r in measured)
            medians[sector] = (de, min(ben, 1.0 - de))
    for r in records:
        if r["sector"] not in in_scope_sectors:
            r.update(de=0.0, ben=0.0, de_ben_status="unclassified")
            r["flags"].append("de-ben-out-of-scope-zero")
        elif r["de_ben_status"] not in MEASURED_DE_BEN_STATUSES:
            de, ben = medians.get(r["sector"], (0.0, 0.0))
            r.update(de=de, ben=ben, de_ben_status="imputed")
            r["flags"].append("de-ben-imputed")
