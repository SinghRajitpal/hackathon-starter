from nzlib import edgar


def test_find_sections_returns_numeric_window():
    text = "intro " * 50 + "Segment information Upstream revenue 1,234 Downstream 5,678 " + "x " * 50
    sections = edgar.find_sections(edgar.html_to_text(f"<p>{text}</p>"), edgar.SEGMENT_PATTERNS, window=200)
    assert len(sections) == 1 and "1,234" in sections[0]


def test_find_sections_prefers_earlier_patterns():
    text = "Aircraft fuel expense 9,819 9,819 9,819 " + "y " * 300 + "Fuel gallons consumed (in millions) 4,269"
    sections = edgar.find_sections(text, edgar.FLEET_FUEL_PATTERNS, window=100, max_sections=1)
    assert "4,269" in sections[0]


def test_find_sections_matches_bare_percentage_generation_table():
    # AEP-style: no "mix"/"generation by fuel" phrase near the table, just fuel words with bare
    # percentages (this was previously missed -- 29 of 31 utilities came back not-found because
    # find_sections never located their actual disclosure table).
    text = (
        "Fuel Supply The following table shows the owned and leased generation sources by type, on an actual "
        "net generation (MWhs) basis: 2025 2024 2023 Coal and Lignite 43% 40% 37% Nuclear 19% 22% 22% "
        "Natural Gas 22% 22% 22% Renewables 16% 16% 19% An increase/decrease in one or more generation types..."
    )
    sections = edgar.find_sections(text, edgar.GENERATION_MIX_PATTERNS, window=200, max_sections=1)
    assert len(sections) == 1
    assert "43%" in sections[0] and "Renewables 16%" in sections[0]


def test_find_sections_matches_sources_of_energy_supply_header():
    # Dominion-style header ("Sources of Energy Supply") didn't match the old
    # 'sources of (electric )?generation' pattern at all.
    text = (
        "Sources of Energy Supply Virginia Power uses a variety of fuels. Presented below is a summary of "
        "Virginia Power's actual system output by energy source: Source 2025 Natural gas 39 % Nuclear 25 % "
        "Purchased power, net 24 Coal 7 Renewable and hydro 5 Total 100 %"
    )
    sections = edgar.find_sections(text, edgar.GENERATION_MIX_PATTERNS, window=200, max_sections=1)
    assert len(sections) == 1 and "Natural gas 39" in sections[0]


def test_find_sections_does_not_get_crowded_out_by_generic_mix_boilerplate():
    # NEE-style bug: a marketing sentence ("...to achieve a more economical fuel mix...") far from
    # any numeric table used to grab a find_sections slot via the generic '(generation|fuel|energy)
    # mix' pattern, before the more specific, table-bearing patterns ever got a chance because both
    # slots were already filled. The generic pattern must now be tried only after the specific ones.
    boilerplate = (
        "the ability of some of its generation facilities to operate on both natural gas and low sulfur "
        "diesel, and on purchased power to maintain the flexibility to achieve a more economical fuel mix "
        "in order to respond to market and industry developments." + " padding" * 400
    )
    table = (
        "FPL SOURCES OF GENERATION As of December 31, 2025, FPL's resources for serving load consisted of "
        "generation sources by type: natural gas 24,314 MW, solar 7,932 MW, nuclear 3,502 MW, coal 215 MW."
    )
    text = table + (" filler" * 400) + boilerplate
    sections = edgar.find_sections(text, edgar.GENERATION_MIX_PATTERNS, window=300, max_sections=1)
    assert len(sections) == 1
    assert "24,314 MW" in sections[0]


def test_html_to_text_strips_tags_and_scripts():
    assert edgar.html_to_text("<script>x=1</script><p>A&amp;B</p>") == "A&B"


def test_latest_10k_and_filing_url():
    subs = {
        "filings": {
            "recent": {
                "form": ["8-K", "10-K"],
                "accessionNumber": ["x", "0000034088-26-000010"],
                "primaryDocument": ["a", "xom-20251231.htm"],
                "reportDate": ["", "2025-12-31"],
            }
        }
    }
    meta = edgar.latest_10k(subs)
    assert edgar.filing_url(34088, meta["accession"], meta["primary_document"]) == (
        "https://www.sec.gov/Archives/edgar/data/34088/000003408826000010/xom-20251231.htm"
    )
    assert edgar.latest_10k({"filings": {"recent": {"form": ["8-K"]}}}) is None
