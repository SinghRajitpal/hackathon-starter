"""EPA GHGRP facility emissions grouped into the PDF §4 source categories and attributed to tickers."""
import re

import pandas as pd

COMBUSTION_COLUMNS = ["Stationary Combustion", "Electricity Generation"]
FUGITIVE_EXTRA_COLUMNS = [
    "Underground Coal Mines",
    "Municipal Landfills",
    "Industrial Wastewater Treatment",
    "Industrial Waste Landfills",
]
FIRST_SUBPART_COLUMN = "Stationary Combustion"
LAST_SUBPART_COLUMN = "Industrial Waste Landfills"

# Whole sheets that are fugitive by construction (subpart W, LDC, SF6), with their total column.
FUGITIVE_SHEETS = {
    "Onshore Oil & Gas Prod.": "Total reported emissions from Onshore Oil & Gas Production ",
    "Gathering & Boosting": "Total reported emissions from Gathering & Boosting",
    "Transmission Pipelines": "Total reported direct emissions from Transmission Pipelines",
    "LDC - Direct Emissions": "Total reported direct emissions from Local Distribution Companies",
    "SF6 from Elec. Equip.": "Total reported direct emissions from Electrical Equipment Use",
}
CATEGORY_COLUMNS = ["combustion", "process", "fugitive"]

LEGAL_SUFFIXES = re.compile(
    r"\b(INC|CORP|CORPORATION|CO|COMPANY|LLC|LTD|LP|LLP|PLC|GROUP|HOLDINGS?|"
    r"THE|INTERNATIONAL|INTL|US|USA|AMERICA|ENERGY|INDUSTRIES)\b",
    re.IGNORECASE,
)
PUNCT = re.compile(r"[.,\-'&]")


def normalize_name(name) -> str:
    """Same normaliser as 08_fetch_epa_scope1.py so matches stay consistent."""
    name = PUNCT.sub(" ", str(name).upper())
    name = LEGAL_SUFFIXES.sub(" ", name)
    return re.sub(r"\s+", " ", name).strip()


def match_key(name) -> str:
    """Space- and punctuation-insensitive join key on top of normalize_name.

    "ExxonMobil" and GHGRP's "EXXON MOBIL CORP" both normalise to the same tokens
    ("EXXON", "MOBIL") but differ in spacing ("EXXONMOBIL" vs "EXXON MOBIL"), so an
    exact string join on normalize_name() alone misses them. Dropping the remaining
    spaces fixes that without touching normalize_name() itself, which other callers
    (12_climate_trace.py) rely on for exact-string comparisons.
    """
    return normalize_name(name).replace(" ", "")


def subpart_groups(columns: list[str]) -> dict[str, list[str]]:
    start = columns.index(FIRST_SUBPART_COLUMN)
    end = columns.index(LAST_SUBPART_COLUMN)
    subparts = columns[start : end + 1]
    fugitive = [c for c in subparts if c.startswith("Petroleum and Natural Gas Systems")] + FUGITIVE_EXTRA_COLUMNS
    process = [c for c in subparts if c not in COMBUSTION_COLUMNS and c not in fugitive]
    return {"combustion": COMBUSTION_COLUMNS, "process": process, "fugitive": fugitive}


def categorize_direct_emitters(df: pd.DataFrame) -> pd.DataFrame:
    groups = subpart_groups(list(df.columns))

    def total(cols: list[str]) -> pd.Series:
        return df[cols].apply(pd.to_numeric, errors="coerce").fillna(0).sum(axis=1)

    return pd.DataFrame(
        {
            "facility_id": df["Facility Id"],
            "total": pd.to_numeric(df["Total reported direct emissions"], errors="coerce").fillna(0),
            **{category: total(cols) for category, cols in groups.items()},
        }
    )


def categorize_fugitive_sheet(df: pd.DataFrame, total_column: str) -> pd.DataFrame:
    total = pd.to_numeric(df[total_column], errors="coerce").fillna(0)
    return pd.DataFrame({"facility_id": df["Facility Id"], "total": total, "combustion": 0.0, "process": 0.0, "fugitive": total})


def attribute_to_tickers(
    facilities: pd.DataFrame,
    parents: pd.DataFrame,
    universe: pd.DataFrame,
    aliases: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """>=50% owner gets the whole facility (same rule as 08_); one owner per facility.

    Tickers join to GHGRP parent names on a space-/punctuation-insensitive `match_key`
    (fixes misses like "ExxonMobil" vs "EXXON MOBIL CORP"). `aliases` (columns: ticker,
    ghgrp_parent_name, evidence) additionally maps specific hand-checked GHGRP parent
    strings straight to a ticker for names that share no common key at all (e.g. "Air
    Products" vs "AIR PRODUCTS & CHEMICALS INC"); it is keyed by literal parent name, so
    it can never match a ticker whose GHGRP parent isn't the exact aliased string.
    """
    owners = (
        parents[parents["PARENT CO. PERCENT OWNERSHIP"] >= 50]
        .sort_values("PARENT CO. PERCENT OWNERSHIP", ascending=False)
        .drop_duplicates("GHGRP FACILITY ID")[["GHGRP FACILITY ID", "PARENT COMPANY NAME"]]
        .dropna()
    )
    joined = facilities.merge(owners, left_on="facility_id", right_on="GHGRP FACILITY ID", how="inner")
    joined["parent_key"] = joined["PARENT COMPANY NAME"].map(match_key)
    by_parent = joined.groupby("parent_key")[["total", *CATEGORY_COLUMNS]].sum().reset_index()

    companies = universe[["ticker", "company_name"]].copy()
    companies["parent_key"] = companies["company_name"].map(match_key)
    matched = companies.merge(by_parent, on="parent_key", how="inner")[["ticker", "total", *CATEGORY_COLUMNS]]

    if aliases is not None and len(aliases):
        alias_lookup = dict(zip(aliases["ghgrp_parent_name"].map(match_key), aliases["ticker"]))
        by_alias = by_parent.copy()
        by_alias["ticker"] = by_alias["parent_key"].map(alias_lookup)
        alias_matched = by_alias.dropna(subset=["ticker"])[["ticker", "total", *CATEGORY_COLUMNS]]
        matched = pd.concat([matched, alias_matched], ignore_index=True)

    # A ticker can in principle match both its own name and an alias (or several aliases);
    # sum rather than drop so no matched emissions are silently discarded.
    return matched.groupby("ticker", as_index=False)[["total", *CATEGORY_COLUMNS]].sum()
