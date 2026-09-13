"""
EPA GHGRP facility emissions grouped into the PDF §4 source categories (combustion, process,
fugitive) and attributed to tickers, for 2023 (latest) and 2019 (PDF §11 validation).

Downloads the EPA data summary spreadsheets and the parent-company file into ../../raw/nz/epa/
if they are not there yet (static annual files, ~30 MB).

Run from data/pipeline/nz:  uv run python 11_ghgrp_categories.py
Output: ../../out/nz/ghgrp_categories.csv -- one row per (ticker, year) with a GHGRP match.
"""
import zipfile
from pathlib import Path

import pandas as pd
import requests

from nzlib.ghgrp import (
    CATEGORY_COLUMNS,
    FUGITIVE_SHEETS,
    attribute_to_tickers,
    categorize_direct_emitters,
    categorize_fugitive_sheet,
)

UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
EPA_DIR = Path("../../raw/nz/epa")
OUT_PATH = Path("../../out/nz/ghgrp_categories.csv")
ALIASES_PATH = Path("maps/ghgrp_parent_aliases.csv")
SUMMARY_URL = "https://www.epa.gov/system/files/other-files/2024-10/2023_data_summary_spreadsheets.zip"
PARENT_URL = "https://www.epa.gov/system/files/other-files/2024-10/ghgp_data_parent_company.xlsb"
YEARS = [2023, 2019]


def download(url: str, path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    response = requests.get(url, timeout=600, headers={"User-Agent": "hackathon-starter nz pipeline"})
    response.raise_for_status()
    path.write_bytes(response.content)


def read_sheet(workbook: pd.ExcelFile, name: str) -> pd.DataFrame:
    """EPA sheets have a few title rows; the header is the row containing 'Facility Id'."""
    raw = workbook.parse(name, header=None, nrows=8)
    header_row = raw.index[raw.apply(lambda r: r.astype(str).str.contains("Facility Id", case=False).any(), axis=1)][0]
    return workbook.parse(name, header=header_row)


def facilities_for_year(year: int) -> pd.DataFrame:
    workbook = pd.ExcelFile(EPA_DIR / f"ghgp_data_{year}.xlsx")
    parts = [categorize_direct_emitters(read_sheet(workbook, "Direct Point Emitters"))]
    for sheet, total_column in FUGITIVE_SHEETS.items():
        if sheet not in workbook.sheet_names:
            print(f"  {year}: sheet '{sheet}' not found, skipped")
            continue
        df = read_sheet(workbook, sheet)
        if total_column not in df.columns:
            print(f"  {year}: column '{total_column}' not found in '{sheet}', skipped")
            continue
        parts.append(categorize_fugitive_sheet(df, total_column))
    return pd.concat(parts, ignore_index=True)


def load_aliases(path: Path = ALIASES_PATH) -> pd.DataFrame:
    """Hand-checked ticker -> literal GHGRP parent-company-name aliases (see docs/decisions-log.md)."""
    return pd.read_csv(path, dtype=str)


def main():
    zip_path = EPA_DIR / "2023_data_summary_spreadsheets.zip"
    parent_path = EPA_DIR / "ghgp_data_parent_company.xlsb"
    download(SUMMARY_URL, zip_path)
    download(PARENT_URL, parent_path)
    with zipfile.ZipFile(zip_path) as archive:
        for year in YEARS:
            member = f"ghgp_data_{year}.xlsx"
            if not (EPA_DIR / member).exists():
                archive.extract(member, EPA_DIR)

    universe = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "company_name"])
    aliases = load_aliases()
    frames = []
    for year in YEARS:
        facilities = facilities_for_year(year)
        parents = pd.read_excel(parent_path, sheet_name=str(year), engine="pyxlsb")
        out = attribute_to_tickers(facilities, parents, universe, aliases=aliases)
        out["year"] = year
        frames.append(out)
        print(f"{year}: {len(facilities)} facilities, {len(out)} tickers matched")

    result = pd.concat(frames, ignore_index=True)
    # A few facilities (21 of 6,470 in 2023) report totals above their subpart columns. The
    # categories define the total; the unattributed remainder is reported (kept as
    # reported_total for reconciliation) and dropped from the category-derived total.
    result = result.rename(columns={"total": "reported_total"})
    unattributed = (result["reported_total"] - result[CATEGORY_COLUMNS].sum(axis=1)).clip(lower=0)
    print(f"Unattributed remainder dropped: {unattributed.sum():,.0f} tCO2e across {(unattributed > 1).sum()} ticker-years")
    result["total"] = result[CATEGORY_COLUMNS].sum(axis=1)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    result[["ticker", "year", "total", "reported_total", *CATEGORY_COLUMNS]].to_csv(OUT_PATH, index=False)
    print(f"Wrote {len(result)} rows to {OUT_PATH}")


if __name__ == "__main__":
    main()
