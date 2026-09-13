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


def attribute_to_tickers(facilities: pd.DataFrame, parents: pd.DataFrame, universe: pd.DataFrame) -> pd.DataFrame:
    """>=50% owner gets the whole facility (same rule as 08_); one owner per facility."""
    owners = (
        parents[parents["PARENT CO. PERCENT OWNERSHIP"] >= 50]
        .sort_values("PARENT CO. PERCENT OWNERSHIP", ascending=False)
        .drop_duplicates("GHGRP FACILITY ID")[["GHGRP FACILITY ID", "PARENT COMPANY NAME"]]
        .dropna()
    )
    joined = facilities.merge(owners, left_on="facility_id", right_on="GHGRP FACILITY ID", how="inner")
    joined["parent_norm"] = joined["PARENT COMPANY NAME"].map(normalize_name)
    by_parent = joined.groupby("parent_norm")[["total", *CATEGORY_COLUMNS]].sum().reset_index()
    companies = universe[["ticker", "company_name"]].copy()
    companies["parent_norm"] = companies["company_name"].map(normalize_name)
    return companies.merge(by_parent, on="parent_norm", how="inner")[["ticker", "total", *CATEGORY_COLUMNS]]
