"""
Tier 2 of DE/BEN (spec D5): label every segment exposed / beneficiary / neutral /
electricity_generation against the PDF §5 product lists, in batches of 50, with Gemini.

Classifies XBRL segments (14_sec_segments.py) and note segments (16_segment_notes.py), so run
14 → 16 → 15. Requires GEMINI_API_KEY. Run from data/pipeline/nz:
  uv run python 15_classify_segments.py
Output: ../../out/nz/segments_classified.csv
        (ticker, member, revenue, method, fiscal_year, filing_url, label, reason, flag)
"""
import argparse
import os
from pathlib import Path

import pandas as pd

from nzlib.classify import CLASSIFY_SCHEMA, batches, build_prompt, parse_labels
from nzlib.gemini import DEFAULT_MODEL, GeminiJson, google_generate

OUT_DIR = Path("../../out/nz")
MAPS_DIR = Path("maps")
CACHE_DIR = Path("../../raw/nz/gemini_cache")
UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")


def load_segments() -> pd.DataFrame:
    xbrl = pd.read_csv(OUT_DIR / "segments_raw.csv")
    xbrl = xbrl.assign(method="xbrl", fiscal_year=pd.to_numeric(xbrl["ddate"].astype(str).str[:4], errors="coerce"))
    frames = [xbrl[["ticker", "member", "revenue", "method", "fiscal_year", "filing_url"]]]
    notes_path = OUT_DIR / "segment_notes.csv"
    if notes_path.exists():
        notes = pd.read_csv(notes_path).assign(method="note")
        frames.append(notes[["ticker", "member", "revenue", "method", "fiscal_year", "filing_url"]])
    return pd.concat(frames, ignore_index=True)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", DEFAULT_MODEL))
    return parser.parse_args()


def main():
    args = parse_args()
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Set GEMINI_API_KEY (free tier, gemini-3.5-flash; override with --model/GEMINI_MODEL).")
    gemini = GeminiJson(google_generate(api_key), CACHE_DIR, model=args.model)

    exposed = pd.read_csv(MAPS_DIR / "exposed_products.csv")["product_line"].tolist()
    beneficiary = pd.read_csv(MAPS_DIR / "beneficiary_products.csv")["product_line"].tolist()
    universe = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "company_name", "sub_industry"]).set_index("ticker")

    segments = load_segments().reset_index(drop=True)
    items = [
        {"id": int(i), "company": universe.at[r.ticker, "company_name"], "sub_industry": universe.at[r.ticker, "sub_industry"], "segment": r.member}
        for i, r in segments.iterrows()
    ]
    labels: dict[int, dict] = {}
    for batch in batches(items):
        response = gemini(build_prompt(batch, exposed, beneficiary), CLASSIFY_SCHEMA)
        labels.update(parse_labels(response, batch))

    segments["label"] = [labels[i]["label"] for i in range(len(segments))]
    segments["reason"] = [labels[i]["reason"] for i in range(len(segments))]
    segments["flag"] = [labels[i]["flag"] for i in range(len(segments))]
    segments.to_csv(OUT_DIR / "segments_classified.csv", index=False)
    print(f"Classified {len(segments)} segments in {len(batches(items))} batches; labels {segments['label'].value_counts().to_dict()}; Gemini calls {gemini.calls}")


if __name__ == "__main__":
    main()
