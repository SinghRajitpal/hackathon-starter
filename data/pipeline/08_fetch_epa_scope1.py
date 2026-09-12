"""
Scope 1 emissions from EPA's Greenhouse Gas Reporting Program (GHGRP) --
US facilities are LEGALLY REQUIRED to report direct emissions here annually
if they emit >25,000 tons CO2e/year. This is the most authoritative and
current free Scope 1 source available (most recent published year: 2023,
~1yr publication lag is standard for this program), but it has real limits:

- Scope 1 only -- EPA does not collect Scope 2 (purchased electricity) data.
- US facilities only -- a multinational's overseas emissions aren't included,
  so this will UNDERCOUNT true global Scope 1 for internationally-heavy
  companies.
- Only facilities above the 25,000 ton/yr threshold -- diversified companies
  with many small/leased sites (retail, most services, tech offices) may
  have zero qualifying facilities even though they have some real footprint.
- Matching is done by normalizing and exact-matching EPA's free-text
  "PARENT COMPANY NAME" against our S&P 500 company names -- there is no
  ticker/CIK field in the EPA data. Multiple facilities per parent are
  summed; ownership percentage is not prorated (treated as fully attributed).

Requires the raw EPA files already downloaded to ../raw/epa/ (see README for
download commands -- not re-fetched automatically here since they're large
static annual files, not an API).

Output: data/out/epa_scope1.csv -- one row per matched ticker only (not all
503; unmatched tickers are simply absent, to be left-joined against the
universe downstream).
"""
import re

import pandas as pd

UNIVERSE_PATH = "../out/universe.csv" if False else None  # not required standalone
FACILITY_FILE = "../raw/epa/ghgp_data_2023.xlsx"
PARENT_FILE = "../raw/epa/parent_company.xlsb"
OUT_PATH = "../out/epa_scope1.csv"
YEAR = 2023

LEGAL_SUFFIXES = re.compile(
    r"\b(INC|CORP|CORPORATION|CO|COMPANY|LLC|LTD|LP|LLP|PLC|GROUP|HOLDINGS?|"
    r"THE|INTERNATIONAL|INTL|US|USA|AMERICA|ENERGY|INDUSTRIES)\b",
    re.IGNORECASE,
)
PUNCT = re.compile(r"[.,\-'&]")


def normalize_name(name: str) -> str:
    name = str(name).upper()
    name = PUNCT.sub(" ", name)
    name = LEGAL_SUFFIXES.sub(" ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def main():
    facilities = pd.read_excel(FACILITY_FILE, sheet_name="Direct Point Emitters", header=3)
    facilities = facilities[["Facility Id", "Total reported direct emissions"]].dropna()

    parents = pd.read_excel(PARENT_FILE, sheet_name=str(YEAR), engine="pyxlsb")
    # EPA's parent-company field reports ANY ownership stake, including
    # passive minority financial ownership (confirmed: BlackRock Inc. shows
    # up as a "parent" of a power station via a 49% fund stake -- it doesn't
    # operate it). Restrict to majority/controlling owners so emissions
    # aren't attributed to companies that don't actually run the facility.
    parents = parents[parents["PARENT CO. PERCENT OWNERSHIP"] >= 50]
    parents = parents[["GHGRP FACILITY ID", "PARENT COMPANY NAME"]].dropna()

    joined = facilities.merge(
        parents, left_on="Facility Id", right_on="GHGRP FACILITY ID", how="inner"
    )
    joined["parent_norm"] = joined["PARENT COMPANY NAME"].map(normalize_name)

    by_parent = joined.groupby("parent_norm")["Total reported direct emissions"].sum().reset_index()
    by_parent.columns = ["parent_norm", "epa_scope1_tco2e"]

    universe = pd.read_csv("../out/universe.csv")
    universe["company_norm"] = universe["company_name"].map(normalize_name)

    matched = universe.merge(by_parent, left_on="company_norm", right_on="parent_norm", how="inner")
    matched["epa_scope1_year"] = YEAR

    out = matched[["ticker", "epa_scope1_tco2e", "epa_scope1_year"]]
    out.to_csv(OUT_PATH, index=False)
    print(f"Matched {len(out)}/{len(universe)} tickers to an EPA GHGRP parent company for {YEAR}")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
