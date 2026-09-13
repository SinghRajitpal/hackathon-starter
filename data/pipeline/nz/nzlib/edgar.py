"""SEC EDGAR helpers: find the latest 10-K and cut out only the section an LLM needs (spec D5 tier 3, D12)."""
import html
import re

# Patterns are in priority order: earlier patterns fill the section budget first.
SEGMENT_PATTERNS = [r"segment information", r"reportable segments", r"business segments", r"segment reporting"]
GENERATION_MIX_PATTERNS = [
    # Specific section-header phrasings first, so a numeric table wins a find_sections slot before
    # the generic '(generation|fuel|energy) mix' pattern below can grab one on a marketing sentence
    # that happens to contain the word "mix" but no table (e.g. NEE's "...achieve a more economical
    # fuel mix..." boilerplate, far from FPL's actual generation-by-fuel disclosure).
    r"fuel/technology mix",
    r"sources of (energy supply|electric generation|generation)",
    r"(generation|energy) sources by (type|fuel)",
    r"actual (system|net) output by (energy|fuel) source",
    r"generation by (fuel|source)",
    r"(coal|natural gas|nuclear|renewable)[^.]{0,80}% of (our |total )?(generation|net generation|energy)",
    r"(generation|fuel|energy) mix",
    # Fallback: bare "<fuel> NN%" table rows with no surrounding "mix"/"sources of" phrase at all
    # (e.g. AEP's "Coal and Lignite 43% Nuclear 19% Natural Gas 22% Renewables 16%").
    r"\b(coal|lignite|natural gas|nuclear|renewables?|hydro|wind|solar|oil)\b[^%\n]{0,25}\d{1,3}(?:\.\d+)?\s*%",
]
FLEET_FUEL_PATTERNS = [
    r"gallons consumed",
    r"fuel gallons",
    r"gallons of (jet|diesel|fuel)",
    r"gallons",
    r"fuel consum",
    # Marine bunker fuel (cruise lines: CCL, RCL, NCLH) is reported in metric tons, not gallons.
    r"fuel consumption in metric tons",
    r"metric tons? of fuel",
    r"metric tons?",
]

SECTION_WINDOW_CHARS = 12_000


def html_to_text(raw: str) -> str:
    raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
    raw = re.sub(r"(?s)<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", html.unescape(raw)).strip()


def find_sections(text: str, patterns: list[str], window: int = SECTION_WINDOW_CHARS, max_sections: int = 2) -> list[str]:
    """Non-overlapping windows at pattern hits. Patterns are tried in order; within one pattern,
    hits with more digits (tables, figures) win."""
    lead_in = min(200, window // 10)
    chosen: list[tuple[int, str]] = []
    for pattern in patterns:
        hits = []
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            start = max(0, match.start() - lead_in)
            chunk = text[start : start + window]
            density = len(re.findall(r"\d", chunk)) / max(len(chunk), 1)
            hits.append((density, start, chunk))
        for _, start, chunk in sorted(hits, key=lambda h: -h[0]):
            if len(chosen) == max_sections:
                break
            if all(abs(start - s) >= window for s, _ in chosen):
                chosen.append((start, chunk))
        if len(chosen) == max_sections:
            break
    return [chunk for _, chunk in sorted(chosen)]


def latest_10k(submissions: dict) -> dict | None:
    """From data.sec.gov/submissions/CIK##########.json → newest 10-K filing metadata."""
    recent = submissions.get("filings", {}).get("recent", {})
    for i, form in enumerate(recent.get("form", [])):
        if form == "10-K":
            return {
                "accession": recent["accessionNumber"][i],
                "primary_document": recent["primaryDocument"][i],
                "report_date": recent["reportDate"][i],
            }
    return None


def filing_url(cik: int, accession: str, primary_document: str) -> str:
    return f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{primary_document}"
