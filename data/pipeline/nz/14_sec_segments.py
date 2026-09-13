"""
Tier 1 of DE/BEN (spec D5): segment and product revenue from the SEC Financial Statement Data
Sets, for the six candidate sectors (PDF §15 "roughly 150 companies in tradeable sectors first").

Downloads quarterly FSDS zips 2025q2..2026q2 into ../../raw/nz/sec_fsds/ (about 85 MB each),
finds each company's latest 10-K, keeps single-axis BusinessSegments / ProductOrService revenue,
and picks the set that reconciles to TTM revenue (nzlib.segments.choose_segments).

Requires SEC_USER_AGENT. Run from data/pipeline/nz:  uv run python 14_sec_segments.py
Outputs: ../../out/nz/segments_raw.csv    (ticker, adsh, ddate, axis, tag, member, revenue, filing_url)
         ../../out/nz/segments_status.csv (ticker, cik, adsh, period, status, filing_url)
         status in tagged | untagged | no-10k | no-cik
"""
import zipfile
from pathlib import Path

import pandas as pd

from nzlib.sec import client_from_env, normalise_ticker
from nzlib.segments import choose_segments, single_axis_rows

QUARTERS = ["2025q2", "2025q3", "2025q4", "2026q1", "2026q2"]
FSDS_URL = "https://www.sec.gov/files/dera/data/financial-statement-data-sets/{quarter}.zip"
RAW_DIR = Path("../../raw/nz/sec_fsds")
OUT_DIR = Path("../../out/nz")
UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
CANDIDATE_SECTORS = ["Energy", "Utilities", "Materials", "Industrials", "Consumer Discretionary", "Consumer Staples"]
CHUNK_ROWS = 2_000_000


def ensure_quarter(sec, quarter: str) -> Path:
    folder = RAW_DIR / quarter
    if (folder / "num.txt").exists() and (folder / "sub.txt").exists():
        return folder
    folder.mkdir(parents=True, exist_ok=True)
    zip_path = RAW_DIR / f"{quarter}.zip"
    if not zip_path.exists():
        print(f"Downloading {quarter}")
        zip_path.write_bytes(sec.get(FSDS_URL.format(quarter=quarter)).content)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extract("num.txt", folder)
        archive.extract("sub.txt", folder)
    zip_path.unlink()
    return folder


def filing_index_url(cik: int, adsh: str) -> str:
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-', '')}/"


def main():
    sec = client_from_env()
    folders = [ensure_quarter(sec, q) for q in QUARTERS]

    universe = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "sector"])
    universe = universe[universe["sector"].isin(CANDIDATE_SECTORS)].copy()
    revenue = pd.read_csv(OUT_DIR / "financials_ttm.csv").set_index("ticker")["revenue_ttm"]
    ciks = sec.cik_map()
    universe["cik"] = universe["ticker"].map(lambda t: ciks.get(normalise_ticker(t)))

    subs = pd.concat(
        [pd.read_csv(f / "sub.txt", sep="\t", dtype=str, usecols=["adsh", "cik", "form", "period"]) for f in folders]
    )
    subs = subs[subs["form"] == "10-K"].copy()
    subs["cik"] = subs["cik"].astype(int)
    latest = subs.sort_values("period").drop_duplicates("cik", keep="last").set_index("cik")

    wanted = set(latest.loc[latest.index.intersection(universe["cik"].dropna().astype(int)), "adsh"])
    facts = []
    for folder in folders:
        columns = ["adsh", "tag", "ddate", "qtrs", "segments", "value"]
        for chunk in pd.read_csv(folder / "num.txt", sep="\t", dtype=str, usecols=columns, chunksize=CHUNK_ROWS):
            facts.append(chunk[chunk["adsh"].isin(wanted)])
    rows = single_axis_rows(pd.concat(facts, ignore_index=True))

    segment_rows, status_rows = [], []
    for u in universe.itertuples():
        status = {"ticker": u.ticker, "cik": u.cik, "adsh": None, "period": None, "status": None, "filing_url": None}
        if pd.isna(u.cik):
            status["status"] = "no-cik"
        elif int(u.cik) not in latest.index:
            status["status"] = "no-10k"
        else:
            filing = latest.loc[int(u.cik)]
            url = filing_index_url(int(u.cik), filing["adsh"])
            status.update(adsh=filing["adsh"], period=filing["period"], filing_url=url)
            chosen = choose_segments(rows[rows["adsh"] == filing["adsh"]], revenue.get(u.ticker))
            status["status"] = "tagged" if len(chosen) else "untagged"
            for s in chosen.itertuples():
                segment_rows.append(
                    {"ticker": u.ticker, "adsh": s.adsh, "ddate": s.ddate, "axis": s.axis, "tag": s.tag,
                     "member": s.member, "revenue": s.value, "filing_url": url}
                )
        status_rows.append(status)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(segment_rows).to_csv(OUT_DIR / "segments_raw.csv", index=False)
    status_df = pd.DataFrame(status_rows)
    status_df.to_csv(OUT_DIR / "segments_status.csv", index=False)
    print(f"{len(segment_rows)} segment rows; statuses {status_df['status'].value_counts().to_dict()}")


if __name__ == "__main__":
    main()
