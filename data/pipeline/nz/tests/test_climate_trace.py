from nzlib import climate_trace


def test_climate_trace_excludes_us_and_unverified_owners_and_splits_equally():
    ours = {"E1"}
    foreign = {"subsector": "oil-and-gas-production", "country": "ARE", "emissionsQuantity": 90.0}
    owners = [{"id": "E1"}, {"id": "E2"}, {"id": "E2"}, {"id": "E3"}]
    assert climate_trace.attribute(foreign, owners, ours) == ("fugitive", 30.0)
    assert climate_trace.attribute({**foreign, "country": "USA"}, owners, ours) is None
    assert climate_trace.attribute(foreign, [{"id": "E9"}], ours) is None
    assert climate_trace.attribute({**foreign, "subsector": "rice-cultivation"}, owners, ours) is None


def test_two_of_our_owner_ids_on_one_asset_take_two_shares():
    source = {"subsector": "cement", "country": "MEX", "emissionsQuantity": 90.0}
    owners = [{"id": "E1"}, {"id": "E4"}, {"id": "E3"}]
    assert climate_trace.attribute(source, owners, {"E1", "E4"}) == ("process", 60.0)


def test_aggregate_sums_by_category():
    assert climate_trace.aggregate([("fleet", 1.0), None, ("fleet", 2.0)]) == {"fleet": 3.0}


def test_is_basin_aggregate_matches_country_basin_type_pattern():
    assert climate_trace.is_basin_aggregate("Qatar_Rub al Khali_LNG") is True
    assert climate_trace.is_basin_aggregate("Saudi Arabia_Widyan - North Arabian Gulf_Conventional onshore") is True
    assert climate_trace.is_basin_aggregate("Ras Laffan LNG Terminal") is False
    assert climate_trace.is_basin_aggregate("ExxonMobil Altona Refinery") is False
    assert climate_trace.is_basin_aggregate("Only_Two") is False
    assert climate_trace.is_basin_aggregate("A__B") is False
    assert climate_trace.is_basin_aggregate("") is False
    assert climate_trace.is_basin_aggregate(None) is False


def test_attribute_excludes_basin_aggregates_in_fugitive_subsectors_only():
    ours = {"E1"}
    owners = [{"id": "E1"}, {"id": "E2"}]
    aggregate_source = {
        "subsector": "oil-and-gas-production",
        "country": "QAT",
        "name": "Qatar_Rub al Khali_LNG",
        "emissionsQuantity": 56_600_000.0,
    }
    # excluded in both mapped fugitive subsectors regardless of verified ownership
    assert climate_trace.attribute(aggregate_source, owners, ours) is None
    assert climate_trace.attribute({**aggregate_source, "subsector": "oil-and-gas-transport"}, owners, ours) is None
    # a real (non-aggregate-named) asset in the same subsector still attributes normally
    named_asset = {**aggregate_source, "name": "Ras Laffan LNG Terminal"}
    assert climate_trace.attribute(named_asset, owners, ours) == ("fugitive", 28_300_000.0)
    # the pattern only applies to the two fugitive subsectors -- an unrelated subsector with an
    # underscore-heavy name is not excluded by it
    other_subsector = {
        "subsector": "cement",
        "country": "MEX",
        "name": "Country_Region_Type",
        "emissionsQuantity": 90.0,
    }
    assert climate_trace.attribute(other_subsector, owners, ours) == ("process", 45.0)


def test_attribute_excludes_us_territories_alongside_usa():
    ours = {"E1"}
    owners = [{"id": "E1"}]
    source = {"subsector": "cement", "emissionsQuantity": 10.0}
    for code in ["USA", "PRI", "GUM", "VIR", "ASM", "MNP"]:
        assert climate_trace.attribute({**source, "country": code}, owners, ours) is None
    assert climate_trace.attribute({**source, "country": "MEX"}, owners, ours) == ("process", 10.0)
