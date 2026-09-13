import pytest

from nzlib import build

SHARES = {"combustion": 0.5, "process": 0.25, "fugitive": 0.25}


def test_ghgrp_split_plus_climate_trace_and_fleet():
    cats, flags, sources = build.merge_emissions(
        ghgrp={"combustion": 70.0, "process": 20.0, "fugitive": 10.0},
        ct={"fugitive": 5.0, "process": 1.0},
        fleet_tco2e=3.0,
        scope1_total=999.0,
        scope1_source="EPA GHGRP",
        sector_shares=SHARES,
    )
    assert cats == {"combustion": 70.0, "fleet": 3.0, "process": 21.0, "fugitive": 15.0}
    assert flags == ["ct-equal-split"]
    assert ("ClimateTRACE", "fugitive", 5.0) in sources and ("10-K fleet", "fleet", 3.0) in sources


def test_reported_total_is_split_by_sector_shares_after_fleet_without_climate_trace():
    cats, flags, sources = build.merge_emissions(None, {"fugitive": 50.0}, 20.0, 100.0, "Wikirate/GRI", SHARES)
    assert cats == {"combustion": 40.0, "fleet": 20.0, "process": 20.0, "fugitive": 20.0}
    assert flags == ["category-split-imputed"]
    assert all(source != "ClimateTRACE" for source, _, _ in sources)
    assert ("10-K fleet", "fleet", 20.0) in sources


def test_total_without_sector_peers_goes_to_combustion_and_is_flagged():
    cats, flags, _ = build.merge_emissions(None, None, None, 10.0, "Wikirate/GRI", None)
    assert cats["combustion"] == pytest.approx(10.0)
    assert flags == ["category-split-no-peers", "category-split-imputed"]


def test_climate_trace_only_and_fleet_only_and_nothing():
    cats, flags, _ = build.merge_emissions(None, {"process": 4.0}, None, None, None, SHARES)
    assert cats == {"combustion": None, "fleet": None, "process": 4.0, "fugitive": None}
    assert flags == ["ct-equal-split", "scope1-us-missing"]
    cats, flags, _ = build.merge_emissions(None, None, 7.0, float("nan"), None, SHARES)
    assert cats["fleet"] == 7.0 and flags == ["scope1-fleet-only"]
    cats, flags, sources = build.merge_emissions(None, None, None, None, None, SHARES)
    assert set(cats.values()) == {None} and flags == [] and sources == []


def test_10k_fleet_takes_precedence_over_climate_trace_fleet_key():
    cats, flags, sources = build.merge_emissions(
        ghgrp={"combustion": 70.0, "process": 20.0, "fugitive": 10.0},
        ct={"fugitive": 5.0, "fleet": 999.0},
        fleet_tco2e=3.0,
        scope1_total=None,
        scope1_source=None,
        sector_shares=SHARES,
    )
    assert cats["fleet"] == 3.0
    assert ("ClimateTRACE", "fleet", 999.0) not in sources
    assert ("10-K fleet", "fleet", 3.0) in sources


def test_climate_trace_fleet_key_used_when_no_10k_fleet_value():
    cats, _, sources = build.merge_emissions(
        ghgrp={"combustion": 70.0, "process": 20.0, "fugitive": 10.0},
        ct={"fleet": 999.0},
        fleet_tco2e=None,
        scope1_total=None,
        scope1_source=None,
        sector_shares=SHARES,
    )
    assert cats["fleet"] == 999.0
    assert ("ClimateTRACE", "fleet", 999.0) in sources


def test_climate_trace_only_branch_flags_scope1_us_missing():
    cats, flags, _ = build.merge_emissions(
        ghgrp=None, ct={"fugitive": 20.0}, fleet_tco2e=None, scope1_total=None, scope1_source=None, sector_shares=None
    )
    assert cats["fugitive"] == 20.0
    assert flags == ["ct-equal-split", "scope1-us-missing"]


def test_ghgrp_reconciliation_flags_tickers_over_half_percent():
    rows = [
        {"ticker": "OK", "total": 998.5, "reported_total": 1000.0},  # 0.15% under threshold
        {"ticker": "BAD", "total": 990.0, "reported_total": 1000.0},  # 1% over threshold
    ]
    assert build.ghgrp_reconciliation_exceptions(rows) == ["BAD"]


def test_ghgrp_reconciliation_skips_missing_or_zero_reported_total():
    rows = [
        {"ticker": "NOREPORT", "total": 5.0, "reported_total": None},
        {"ticker": "ZERO", "total": 5.0, "reported_total": 0.0},
        {"ticker": "NOCOL", "total": 5.0},
    ]
    assert build.ghgrp_reconciliation_exceptions(rows) == []


def test_ghgrp_reconciliation_custom_threshold():
    rows = [{"ticker": "A", "total": 99.0, "reported_total": 100.0}]
    assert build.ghgrp_reconciliation_exceptions(rows, threshold=0.02) == []
    assert build.ghgrp_reconciliation_exceptions(rows, threshold=0.005) == ["A"]
