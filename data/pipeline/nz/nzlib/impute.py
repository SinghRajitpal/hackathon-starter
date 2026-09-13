"""Emissions imputation rules (spec D11, D14)."""
import pandas as pd

SPLIT_CATEGORIES = ["combustion", "process", "fugitive"]


def impute_scope2(df: pd.DataFrame) -> pd.DataFrame:
    """Fill missing e_scope2 with sector-median Scope 2 intensity × revenue_ttm; append a flag.

    Expects columns: sector, e_scope2, revenue_ttm, flags (list).
    """
    out = df.copy()
    out["flags"] = out["flags"].map(list)
    known = out[out["e_scope2"].notna() & (out["revenue_ttm"] > 0)]
    intensity = (known["e_scope2"] / known["revenue_ttm"]).groupby(known["sector"]).median()
    for idx, row in out.iterrows():
        if pd.notna(row["e_scope2"]):
            continue
        if row["sector"] in intensity.index and pd.notna(row["revenue_ttm"]) and row["revenue_ttm"] > 0:
            out.at[idx, "e_scope2"] = float(intensity[row["sector"]]) * float(row["revenue_ttm"])
            out.at[idx, "flags"] = [*row["flags"], "scope2-imputed"]
    return out


def sector_category_shares(ghgrp: pd.DataFrame) -> dict[str, dict[str, float]]:
    """Median combustion/process/fugitive shares of GHGRP-split companies per sector, renormalised to 1.

    Expects columns: sector, combustion, process, fugitive.
    """
    df = ghgrp.copy()
    total = df[SPLIT_CATEGORIES].sum(axis=1)
    df = df[total > 0]
    shares = df[SPLIT_CATEGORIES].div(total[total > 0], axis=0)
    shares["sector"] = df["sector"]
    result: dict[str, dict[str, float]] = {}
    for sector, group in shares.groupby("sector"):
        med = group[SPLIT_CATEGORIES].median()
        s = med.sum()
        result[sector] = {c: (float(med[c]) / s if s > 0 else 1 / 3) for c in SPLIT_CATEGORIES}
    return result


def split_wikirate_total(scope1_total: float, fleet: float | None, shares: dict[str, float]) -> dict[str, float]:
    """D14: take fleet out first (floor 0), split the remainder by sector-median shares."""
    fleet_part = min(max(fleet or 0.0, 0.0), scope1_total)
    remainder = scope1_total - fleet_part
    return {"fleet": fleet_part, **{c: remainder * shares[c] for c in SPLIT_CATEGORIES}}
