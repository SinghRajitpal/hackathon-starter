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
