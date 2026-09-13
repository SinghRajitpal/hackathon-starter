from nzlib import edgar


def test_find_sections_returns_numeric_window():
    text = "intro " * 50 + "Segment information Upstream revenue 1,234 Downstream 5,678 " + "x " * 50
    sections = edgar.find_sections(edgar.html_to_text(f"<p>{text}</p>"), edgar.SEGMENT_PATTERNS, window=200)
    assert len(sections) == 1 and "1,234" in sections[0]


def test_find_sections_prefers_earlier_patterns():
    text = "Aircraft fuel expense 9,819 9,819 9,819 " + "y " * 300 + "Fuel gallons consumed (in millions) 4,269"
    sections = edgar.find_sections(text, edgar.FLEET_FUEL_PATTERNS, window=100, max_sections=1)
    assert "4,269" in sections[0]


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
