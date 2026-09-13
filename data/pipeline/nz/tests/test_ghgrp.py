import pandas as pd

from nzlib import ghgrp


def direct_emitters_frame() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "Facility Id": [1, 2],
            "Total reported direct emissions": [100.0, 50.0],
            "Stationary Combustion": [60.0, None],
            "Electricity Generation": [10.0, None],
            "Cement Production": [20.0, None],
            "Petroleum Refining": [None, 30.0],
            "Petroleum and Natural Gas Systems – Processing": [10.0, 20.0],
            "Underground Coal Mines": [None, None],
            "Municipal Landfills": [None, None],
            "Industrial Wastewater Treatment": [None, None],
            "Industrial Waste Landfills": [None, None],
        }
    )


def test_direct_emitter_subparts_map_to_categories_and_sum_to_total():
    out = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    assert out.loc[0, ["combustion", "process", "fugitive"]].tolist() == [70.0, 20.0, 10.0]
    assert out.loc[1, ["combustion", "process", "fugitive"]].tolist() == [0.0, 30.0, 20.0]
    assert (out[["combustion", "process", "fugitive"]].sum(axis=1) == out["total"]).all()


def test_fugitive_sheet_is_all_fugitive():
    sheet = pd.DataFrame({"Facility Id": [7], "Total reported direct emissions from Transmission Pipelines": [12.0]})
    out = ghgrp.categorize_fugitive_sheet(sheet, "Total reported direct emissions from Transmission Pipelines")
    assert out.loc[0, ["total", "combustion", "process", "fugitive"]].tolist() == [12.0, 0.0, 0.0, 12.0]


def test_attribution_uses_majority_owner_once_per_facility():
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = pd.DataFrame(
        {
            "GHGRP FACILITY ID": [1, 1, 2],
            "PARENT COMPANY NAME": ["Acme Corp", "BlackRock Inc", "Acme Corporation"],
            "PARENT CO. PERCENT OWNERSHIP": [51.0, 49.0, 100.0],
        }
    )
    universe = pd.DataFrame({"ticker": ["ACME", "BLK"], "company_name": ["Acme Inc.", "BlackRock"]})
    out = ghgrp.attribute_to_tickers(facilities, parents, universe)
    assert out["ticker"].tolist() == ["ACME"]
    assert out.loc[0, "total"] == 150.0


def empty_aliases() -> pd.DataFrame:
    return pd.DataFrame(columns=["ticker", "ghgrp_parent_name", "evidence"])


def one_facility_parent(parent_name: str) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "GHGRP FACILITY ID": [1],
            "PARENT COMPANY NAME": [parent_name],
            "PARENT CO. PERCENT OWNERSHIP": [100.0],
        }
    )


def test_match_key_is_space_and_punctuation_insensitive():
    assert ghgrp.match_key("ExxonMobil") == ghgrp.match_key("Exxon Mobil Corp")
    # Genuinely different companies must not collapse into the same key.
    assert ghgrp.match_key("Air Products") != ghgrp.match_key("Air Products & Chemicals Inc")


def test_attribution_matches_parent_names_that_differ_only_by_spacing():
    """'ExxonMobil' vs GHGRP's 'EXXON MOBIL CORP' — was a miss before the space-insensitive join."""
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = one_facility_parent("Exxon Mobil Corp")
    universe = pd.DataFrame({"ticker": ["XOM"], "company_name": ["ExxonMobil"]})
    out = ghgrp.attribute_to_tickers(facilities, parents, universe, aliases=empty_aliases())
    assert out["ticker"].tolist() == ["XOM"]
    assert out.loc[0, "total"] == 100.0


def test_attribution_uses_hand_checked_alias_for_names_that_share_no_common_key():
    """'Air Products' vs GHGRP's 'AIR PRODUCTS & CHEMICALS INC' needs the hand-checked alias map."""
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = one_facility_parent("Air Products & Chemicals Inc")
    universe = pd.DataFrame({"ticker": ["APD"], "company_name": ["Air Products"]})
    aliases = pd.DataFrame(
        {"ticker": ["APD"], "ghgrp_parent_name": ["Air Products & Chemicals Inc"], "evidence": ["test"]}
    )
    out = ghgrp.attribute_to_tickers(facilities, parents, universe, aliases=aliases)
    assert out["ticker"].tolist() == ["APD"]
    assert out.loc[0, "total"] == 100.0


def test_attribution_alias_does_not_leak_to_other_tickers():
    """An alias for one ticker must not falsely match a different, unrelated company."""
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = one_facility_parent("Air Products & Chemicals Inc")
    universe = pd.DataFrame({"ticker": ["APD", "OTHER"], "company_name": ["Air Products", "Other Co"]})
    aliases = pd.DataFrame(
        {"ticker": ["APD"], "ghgrp_parent_name": ["Air Products & Chemicals Inc"], "evidence": ["test"]}
    )
    out = ghgrp.attribute_to_tickers(facilities, parents, universe, aliases=aliases)
    assert out["ticker"].tolist() == ["APD"]


def test_attribution_without_aliases_argument_still_works():
    """aliases is optional; omitting it must not break the plain name-matching path."""
    facilities = ghgrp.categorize_direct_emitters(direct_emitters_frame())
    parents = one_facility_parent("Acme Corp")
    universe = pd.DataFrame({"ticker": ["ACME"], "company_name": ["Acme Inc."]})
    out = ghgrp.attribute_to_tickers(facilities, parents, universe)
    assert out["ticker"].tolist() == ["ACME"]
