"""
Vehicle-fleet Scope 1 emissions from 10-K fuel disclosures (spec D12).

For fleet-heavy sub-industries: find the latest 10-K on EDGAR, cut out only the fuel-volume
passages (nzlib.edgar.FLEET_FUEL_PATTERNS), ask Gemini to extract stated volumes, convert with
EPA GHG Emission Factors Hub 2025 Table 2 (nzlib.fleet). Volumes are never inferred from dollars.

Requires SEC_USER_AGENT and GEMINI_API_KEY in the environment
(set -a; source ../../../.env.local; set +a).

Run from data/pipeline/nz:  uv run python 13_fleet_fuel.py
Output: ../../out/nz/fleet.csv -- one row per candidate ticker, status in
        extracted | not-disclosed | no-10k | no-cik | error.
"""
import os
from pathlib import Path

import pandas as pd

from nzlib.edgar import FLEET_FUEL_PATTERNS, filing_url, find_sections, html_to_text, latest_10k
from nzlib.fleet import fuel_to_tco2e
from nzlib.gemini import GeminiJson, google_generate
from nzlib.sec import client_from_env, normalise_ticker

UNIVERSE_PATH = Path("../../out/sp500_esg_financials_raw.csv")
OUT_PATH = Path("../../out/nz/fleet.csv")
CACHE_DIR = Path("../../raw/nz/gemini_cache")
FLEET_SUB_INDUSTRIES = [
    "Air Freight & Logistics",
    "Automotive Retail",
    "Cargo Ground Transportation",
    "Distributors",
    "Environmental & Facilities Services",
    "Food Distributors",
    "Hotels, Resorts & Cruise Lines",
    "Leisure Products",
    "Passenger Airlines",
    "Passenger Ground Transportation",
    "Rail Transportation",
    "Trading Companies & Distributors",
]
SECTION_WINDOW = 6000

FLEET_SCHEMA = {
    "type": "object",
    "properties": {
        "fiscal_year": {"type": "integer", "description": "fiscal year of the volumes; 0 if not stated"},
        "fuels": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "fuel": {
                        "type": "string",
                        "enum": ["jet_fuel", "aviation_gasoline", "diesel", "gasoline", "lpg", "residual_fuel_oil", "cng"],
                    },
                    "quantity": {"type": "number"},
                    "unit": {"type": "string", "enum": ["gallons", "million_gallons", "barrels", "scf"]},
                    "quote": {"type": "string"},
                },
                "required": ["fuel", "quantity", "unit", "quote"],
            },
        },
    },
    "required": ["fiscal_year", "fuels"],
}


def prompt_for(company: str, excerpts: list[str]) -> str:
    joined = "\n\n---\n\n".join(excerpts)
    return (
        f"These are excerpts from the latest 10-K of {company}.\n"
        "Extract the fuel the company itself consumed in its most recent fiscal year for its own vehicles, "
        "aircraft, ships or locomotives. Only use quantities explicitly stated as volumes (gallons, barrels, "
        "standard cubic feet). Never convert dollar amounts into volumes. If a table says '(in millions)', "
        "use unit million_gallons. If no volume is stated, return an empty fuels list. Quote the sentence or "
        "table row for each fuel. Use fiscal_year 0 if the year is not stated.\n\n"
        f"Excerpts:\n{joined}"
    )


def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("Set GEMINI_API_KEY (free tier, gemini-3.5-flash).")
    sec = client_from_env()
    gemini = GeminiJson(google_generate(api_key), CACHE_DIR)

    universe = pd.read_csv(UNIVERSE_PATH, usecols=["ticker", "company_name", "sub_industry"])
    candidates = universe[universe["sub_industry"].isin(FLEET_SUB_INDUSTRIES)]
    print(f"{len(candidates)} fleet candidates")
    ciks = sec.cik_map()

    rows = []
    for c in candidates.itertuples():
        row = {"ticker": c.ticker, "status": None, "fleet_tco2e": None, "fiscal_year": None, "filing_url": None, "quotes": None, "error": None}
        try:
            cik = ciks.get(normalise_ticker(c.ticker))
            if cik is None:
                row["status"] = "no-cik"
            elif (meta := latest_10k(sec.submissions(cik))) is None:
                row["status"] = "no-10k"
            else:
                row["filing_url"] = filing_url(cik, meta["accession"], meta["primary_document"])
                text = html_to_text(sec.get(row["filing_url"]).text)
                excerpts = find_sections(text, FLEET_FUEL_PATTERNS, window=SECTION_WINDOW, max_sections=2)
                response = gemini(prompt_for(c.company_name, excerpts), FLEET_SCHEMA) if excerpts else {"fuels": []}
                if not response["fuels"]:
                    row["status"] = "not-disclosed"
                else:
                    row.update(
                        status="extracted",
                        fleet_tco2e=fuel_to_tco2e(response["fuels"]),
                        fiscal_year=response.get("fiscal_year") or None,
                        quotes=" | ".join(f["quote"] for f in response["fuels"]),
                    )
        except Exception as exc:  # noqa: BLE001 -- one bad filing must not kill the run
            row.update(status="error", error=str(exc))
        print(f"{c.ticker}: {row['status']} {row['fleet_tco2e'] or ''}")
        rows.append(row)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows)
    df.to_csv(OUT_PATH, index=False)
    print(f"Wrote {len(df)} rows to {OUT_PATH}; statuses {df['status'].value_counts().to_dict()}; Gemini calls {gemini.calls}")


if __name__ == "__main__":
    main()
