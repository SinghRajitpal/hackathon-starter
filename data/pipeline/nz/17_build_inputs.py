"""
Merge every source into one engine input row per ticker (spec §5, D10, D11, D13, D14, D16).

Emissions: GHGRP category split (2023) + Climate TRACE non-US + 10-K fleet; otherwise the reported
Scope 1 total split by sector-median GHGRP shares with fleet first; Scope 2 from Wikirate, imputed
from sector-median intensity only for companies that have some Scope 1 data. DE/BEN stay empty
(status 'unclassified') until P4.

Run from data/pipeline/nz:  uv run python 17_build_inputs.py
Outputs: ../../out/nz/company_inputs.csv (one row per ticker, flags pipe-joined)
         ../../out/nz/emissions_sources.csv (ticker, source, category, tco2e, year, reference)
"""
from pathlib import Path

import pandas as pd

from nzlib.build import SCOPE1_CATEGORIES, merge_emissions, present
from nzlib.corrections import apply_scope1_corrections
from nzlib.impute import impute_scope2, sector_category_shares

OUT_DIR = Path("../../out/nz")
UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
FINANCIALS_PATH = OUT_DIR / "financials_ttm.csv"
GHGRP_PATH = OUT_DIR / "ghgrp_categories.csv"
CT_PATH = OUT_DIR / "ct_categories.csv"
FLEET_PATH = OUT_DIR / "fleet.csv"
SCOPE1_CORRECTIONS_PATH = Path("maps/scope1_corrections.csv")
INPUTS_PATH = OUT_DIR / "company_inputs.csv"
SOURCES_PATH = OUT_DIR / "emissions_sources.csv"
LATEST_GHGRP_YEAR = 2023

REFERENCES = {
    "GHGRP": "EPA GHGRP 2023 data summary spreadsheets",
    "ClimateTRACE": "Climate TRACE v7 sources 2024, verified owner, equal split",
    "10-K fleet": "Latest 10-K fuel disclosure x EPA Emission Factors Hub 2025 Table 2",
    "Wikirate/GRI": "Wikirate GRI 305-1 / 305-2",
    "EPA GHGRP": "EPA GHGRP total (08_fetch_epa_scope1.py)",
    "imputed": "Sector-median Scope 2 intensity x TTM revenue",
}


def read_optional(path: Path) -> pd.DataFrame | None:
    """ghgrp_categories.csv, ct_categories.csv and fleet.csv are all optional: when one is missing,
    that source is treated as empty (e.g. no Climate TRACE non-US emissions, no 10-K fleet) rather
    than failing the run."""
    if path.exists():
        return pd.read_csv(path)
    print(f"  missing optional input: {path} (skipped)")
    return None


def build_frames() -> tuple[pd.DataFrame, pd.DataFrame]:
    universe = pd.read_csv(
        UNIVERSE_PATH,
        usecols=["ticker", "company_name", "sector", "sub_industry", "scope1_tco2e", "scope1_source", "scope2_tco2e"],
    )
    if SCOPE1_CORRECTIONS_PATH.exists():
        universe, scope1_corrected = apply_scope1_corrections(universe, pd.read_csv(SCOPE1_CORRECTIONS_PATH))
    else:
        scope1_corrected = set()
    financials = pd.read_csv(FINANCIALS_PATH).set_index("ticker")

    # ghgrp_categories.csv carries an extra `reported_total` column (EPA's own total, used only by
    # check_inputs.py's reconciliation check) — read every column so it passes through untouched.
    ghgrp_df = read_optional(GHGRP_PATH)
    ghgrp, shares = {}, {}
    if ghgrp_df is not None:
        latest = ghgrp_df[ghgrp_df["year"] == LATEST_GHGRP_YEAR]
        ghgrp = latest.set_index("ticker").to_dict("index")
        shares = sector_category_shares(latest.merge(universe[["ticker", "sector"]], on="ticker"))

    ct_df = read_optional(CT_PATH)
    ct, ct_flags = {}, {}
    if ct_df is not None:
        for r in ct_df.to_dict("records"):
            values = {c: present(r.get(c)) for c in SCOPE1_CATEGORIES}
            ct[r["ticker"]] = {c: v for c, v in values.items() if v}
            if isinstance(r.get("flags"), str) and r["flags"]:
                ct_flags[r["ticker"]] = [f for f in r["flags"].split("|") if f]

    fleet_df = read_optional(FLEET_PATH)
    fleet_status = {} if fleet_df is None else fleet_df.set_index("ticker")["status"].to_dict()
    fleet = {} if fleet_df is None else fleet_df[fleet_df["status"] == "extracted"].set_index("ticker")["fleet_tco2e"].to_dict()

    rows, sources = [], []
    for u in universe.to_dict("records"):
        ticker = u["ticker"]
        categories, flags, source_rows = merge_emissions(
            ghgrp=ghgrp.get(ticker),
            ct=ct.get(ticker),
            fleet_tco2e=fleet.get(ticker),
            scope1_total=u["scope1_tco2e"],
            scope1_source=u["scope1_source"] if isinstance(u["scope1_source"], str) else None,
            sector_shares=shares.get(u["sector"]),
        )
        flags.extend(ct_flags.get(ticker, []))
        if ticker in scope1_corrected:
            flags.append("scope1-corrected")
        if fleet_status.get(ticker) == "not-disclosed":
            flags.append("fleet-fuel-not-disclosed")

        scope2 = present(u["scope2_tco2e"])
        if scope2 is not None:
            source_rows.append(("Wikirate/GRI", "scope2", scope2))

        f = financials.loc[ticker] if ticker in financials.index else None
        if f is None or isinstance(f.get("fetch_error"), str):
            flags.append("financials-fetch-error")
        if f is not None and isinstance(f.get("cap_flag"), str):
            flags.append(f["cap_flag"])

        rows.append(
            {
                "ticker": ticker,
                "company_name": u["company_name"],
                "sector": u["sector"],
                "sub_industry": u["sub_industry"],
                "e_scope2": scope2,
                **{f"e_{c}": categories[c] for c in SCOPE1_CATEGORIES},
                "emissions_year": LATEST_GHGRP_YEAR if ticker in ghgrp else None,
                "revenue_ttm": None if f is None else present(f.get("revenue_ttm")),
                "ebitda_ttm": None if f is None else present(f.get("ebitda_ttm")),
                "fcf_ttm": None if f is None else present(f.get("fcf_ttm")),
                "net_debt": None if f is None else present(f.get("net_debt")),
                "de": None,
                "ben": None,
                "de_ben_status": "unclassified",
                "fossil_generation_share": None,
                "renewable_generation_share": None,
                "price": None if f is None else present(f.get("price")),
                "shares_outstanding": None if f is None else present(f.get("shares_outstanding")),
                "float_cap": None if f is None else present(f.get("float_cap")),
                "flags": flags,
            }
        )
        for source, category, tco2e in source_rows:
            sources.append(
                {
                    "ticker": ticker,
                    "source": source,
                    "category": category,
                    "tco2e": tco2e,
                    "year": LATEST_GHGRP_YEAR if source == "GHGRP" else None,
                    "reference": REFERENCES.get(source, source),
                }
            )

    inputs = pd.DataFrame(rows)
    has_scope1 = inputs[[f"e_{c}" for c in SCOPE1_CATEGORIES]].notna().any(axis=1)
    imputed = impute_scope2(inputs.loc[has_scope1, ["sector", "e_scope2", "revenue_ttm", "flags"]])
    newly = imputed.index[inputs.loc[has_scope1, "e_scope2"].isna() & imputed["e_scope2"].notna()]
    inputs.loc[imputed.index, "e_scope2"] = imputed["e_scope2"]
    inputs.loc[imputed.index, "flags"] = imputed["flags"]
    for idx in newly:
        sources.append(
            {
                "ticker": inputs.at[idx, "ticker"],
                "source": "imputed",
                "category": "scope2",
                "tco2e": inputs.at[idx, "e_scope2"],
                "year": None,
                "reference": REFERENCES["imputed"],
            }
        )
    return inputs, pd.DataFrame(sources)


def main():
    inputs, sources = build_frames()
    assert inputs["ticker"].is_unique
    inputs["flags"] = inputs["flags"].map(lambda f: "|".join(dict.fromkeys(f)))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    inputs.to_csv(INPUTS_PATH, index=False)
    sources.to_csv(SOURCES_PATH, index=False)
    print(f"Wrote {len(inputs)} company rows and {len(sources)} source rows")


if __name__ == "__main__":
    main()
