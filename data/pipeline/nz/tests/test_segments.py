import pandas as pd

from nzlib import segments


def test_single_axis_rows_keep_only_segment_or_product_members():
    num = pd.DataFrame(
        {
            "adsh": ["a"] * 7,
            "tag": ["Revenues"] * 6 + ["NetIncomeLoss"],
            "ddate": ["20251231"] * 7,
            "qtrs": ["4", "4", "4", "1", "4", "4", "4"],
            "segments": [
                "BusinessSegments=Upstream;",
                "BusinessSegments=Downstream;Geographical=US;",
                "BusinessSegments=IntersegmentElimination;",
                "BusinessSegments=Upstream;",
                "BusinessSegments=FordPro;ConsolidationItems=OperatingSegments;",
                "BusinessSegments=CompanyExcludingFordCredit;",
                "BusinessSegments=Upstream;",
            ],
            "value": ["10", "5", "-1", "3", "66", "174", "2"],
        }
    )
    out = segments.single_axis_rows(num)
    assert out["member"].tolist() == ["Upstream", "FordPro"]
    assert out["value"].tolist() == [10.0, 66.0]


def test_choose_segments_prefers_axis_that_reconciles_to_revenue():
    rows = pd.DataFrame(
        {
            "tag": ["Revenues"] * 4,
            "ddate": ["20251231"] * 4,
            "axis": ["ProductOrService", "ProductOrService", "BusinessSegments", "BusinessSegments"],
            "member": ["Cars", "Parts", "Blue", "EV"],
            "value": [10.0, 5.0, 60.0, 40.0],
        }
    )
    assert segments.choose_segments(rows, 100.0)["member"].tolist() == ["Blue", "EV"]
    assert segments.choose_segments(rows, 15.0)["member"].tolist() == ["Cars", "Parts"]
    assert segments.choose_segments(rows, 1000.0).empty
