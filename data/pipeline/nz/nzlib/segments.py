"""SEC Financial Statement Data Sets: single-axis segment / product revenue (spec D5 tier 1)."""
import re

import pandas as pd

REVENUE_TAGS = {
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "RegulatedAndUnregulatedOperatingRevenue",
    "SalesRevenueNet",
}
AXES = ("ProductOrService", "BusinessSegments")
EXCLUDED_MEMBER = re.compile(
    r"Total|Aggregation|AllOther|Elimination|Corporate|Reconcil|Excluding|Consolidated|Tax", re.IGNORECASE
)
# A non-reconciling fallback set must still cover this share of revenue, else tier 3 reads the note.
MIN_FALLBACK_COVERAGE = 0.5
# Filers often tag segment revenue with this second dimension; it does not change the meaning.
IGNORABLE_DIMENSION = "ConsolidationItems=OperatingSegments"
# A candidate segment set must sum to within this share of total revenue.
SUM_TOLERANCE = 0.10


def _primary_dimension(segments_value: str) -> str | None:
    dims = [d for d in segments_value.rstrip(";").split(";") if d and d != IGNORABLE_DIMENSION]
    return dims[0] if len(dims) == 1 else None


def single_axis_rows(num: pd.DataFrame) -> pd.DataFrame:
    """Annual revenue facts with exactly one meaningful dimension on a segment or product axis."""
    df = num[num["tag"].isin(REVENUE_TAGS) & (num["qtrs"].astype(str) == "4") & num["segments"].notna()].copy()
    df["dimension"] = df["segments"].map(_primary_dimension)
    df = df[df["dimension"].notna()]
    parts = df["dimension"].str.split("=", n=1, expand=True)
    df["axis"] = parts[0]
    df["member"] = parts[1]
    df = df[df["axis"].isin(AXES) & ~df["member"].str.contains(EXCLUDED_MEMBER)]
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    return df.dropna(subset=["value"])


def choose_segments(rows: pd.DataFrame, total_revenue: float | None) -> pd.DataFrame:
    """For one filing: newest period, one tag, ProductOrService preferred when it reconciles to revenue."""
    if rows.empty:
        return rows
    latest = rows[rows["ddate"] == rows["ddate"].max()]
    fallback = None
    for axis in AXES:
        candidate = latest[latest["axis"] == axis]
        if candidate.empty:
            continue
        tag = candidate["tag"].value_counts().idxmax()
        candidate = candidate[candidate["tag"] == tag].drop_duplicates("member")
        if total_revenue and abs(candidate["value"].sum() - total_revenue) / total_revenue <= SUM_TOLERANCE:
            return candidate
        covers = not total_revenue or candidate["value"].sum() >= MIN_FALLBACK_COVERAGE * total_revenue
        if fallback is None and covers:
            fallback = candidate
    return fallback if fallback is not None else latest.iloc[0:0]
