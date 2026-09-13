"""
Fails loudly when the nz pipeline outputs break an invariant, and prints coverage per sector
(spec §9 "Real data"). Run after 17_build_inputs.py and before 19_load_supabase.py.

Run from data/pipeline/nz:  uv run python check_inputs.py
"""
import sys
from pathlib import Path

import pandas as pd

from nzlib.build import ghgrp_reconciliation_exceptions

OUT_DIR = Path("../../out/nz")
CATEGORIES = ["scope2", "combustion", "fleet", "process", "fugitive"]
TOLERANCE = 0.001
LATEST_GHGRP_YEAR = 2023
MAX_GHGRP_EXCEPTIONS = 5


def main():
    inputs = pd.read_csv(OUT_DIR / "company_inputs.csv")
    sources = pd.read_csv(OUT_DIR / "emissions_sources.csv")
    failures = []

    if not inputs["ticker"].is_unique:
        failures.append("duplicate tickers in company_inputs.csv")
    for c in CATEGORIES:
        if (inputs[f"e_{c}"].dropna() < 0).any():
            failures.append(f"negative e_{c}")
    both = inputs.dropna(subset=["de", "ben"])
    if ((both["de"] + both["ben"]) > 1 + 1e-9).any():
        failures.append("DE + BEN above 1")

    by_category = sources.groupby(["ticker", "category"])["tco2e"].sum()
    for row in inputs.itertuples():
        for c in CATEGORIES:
            value = getattr(row, f"e_{c}")
            key = (row.ticker, c)
            if pd.isna(value):
                if key in by_category.index:
                    failures.append(f"{row.ticker} {c}: source rows but empty input")
                continue
            expected = by_category.get(key, 0.0)
            if abs(expected - value) > abs(value) * TOLERANCE + 1.0:
                failures.append(f"{row.ticker} {c}: sources sum {expected} != input {value}")

    # Ruling (progress.md, P1 pre-flight scan): the tautological "GHGRP categories sum to GHGRP total
    # within 0.1%" check is replaced by a per-ticker reconciliation against EPA's own reported_total
    # (year 2023 only); exceptions are printed but only fail the run past MAX_GHGRP_EXCEPTIONS tickers.
    ghgrp_path = OUT_DIR / "ghgrp_categories.csv"
    if ghgrp_path.exists():
        ghgrp = pd.read_csv(ghgrp_path)
        latest = ghgrp[ghgrp["year"] == LATEST_GHGRP_YEAR]
        exceptions = ghgrp_reconciliation_exceptions(latest.to_dict("records"))
        if exceptions:
            print(
                f"GHGRP reconciliation exceptions (|reported_total - total| / reported_total > 0.5%, "
                f"{LATEST_GHGRP_YEAR}): {exceptions}"
            )
        if len(exceptions) > MAX_GHGRP_EXCEPTIONS:
            failures.append(
                f"GHGRP reconciliation: {len(exceptions)} tickers exceed 0.5% (max {MAX_GHGRP_EXCEPTIONS} allowed)"
            )

    scope1 = inputs[[f"e_{c}" for c in CATEGORIES[1:]]].notna().any(axis=1)
    flags = inputs["flags"].fillna("")
    coverage = pd.DataFrame(
        {
            "sector": inputs["sector"],
            "companies": 1,
            "scope1_any": scope1,
            "scope2_reported": inputs["e_scope2"].notna() & ~flags.str.contains("scope2-imputed"),
            "scope2_imputed": flags.str.contains("scope2-imputed"),
            "ebitda": inputs["ebitda_ttm"].notna(),
            "float_cap": inputs["float_cap"].notna(),
            "de_ben_measured": inputs["de_ben_status"].isin(["tagged", "note"]),
        }
    ).groupby("sector").sum()
    print(coverage.to_string())
    print("de_ben_status:", inputs["de_ben_status"].value_counts().to_dict())

    if failures:
        print("\nFAILED:\n" + "\n".join(failures[:50]), file=sys.stderr)
        sys.exit(1)
    print("\nAll invariants hold.")


if __name__ == "__main__":
    main()
