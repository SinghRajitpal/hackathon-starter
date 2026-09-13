import math

import numpy as np
import pandas as pd
import pytest

from nzlib import supabase_rest as rest


class FakeResponse:
    def __init__(self, headers=None):
        self.headers = headers or {}
        self.raised = False

    def raise_for_status(self):
        self.raised = True


class FakeSession:
    def __init__(self, response=None):
        self.calls = []
        self._response = response or FakeResponse()

    def post(self, url, headers=None, json=None):
        self.calls.append(("POST", url, headers, json))
        return self._response

    def delete(self, url, headers=None):
        self.calls.append(("DELETE", url, headers, None))
        return self._response

    def get(self, url, headers=None):
        self.calls.append(("GET", url, headers, None))
        return self._response


# --- env_config -------------------------------------------------------------------------


def test_env_config_strips_trailing_slash_and_builds_headers():
    base_url, headers = rest.env_config({"SUPABASE_URL": "https://x.supabase.co/", "SUPABASE_SECRET_KEY": "sb_secret_abc"})
    assert base_url == "https://x.supabase.co"
    assert headers == {
        "apikey": "sb_secret_abc",
        "Authorization": "Bearer sb_secret_abc",
        "Content-Type": "application/json",
    }


def test_env_config_raises_when_missing():
    with pytest.raises(RuntimeError):
        rest.env_config({})
    with pytest.raises(RuntimeError):
        rest.env_config({"SUPABASE_URL": "https://x.supabase.co"})


# --- build_payload ------------------------------------------------------------------------


def test_build_payload_turns_nan_and_none_into_null():
    rows = rest.build_payload([{"ticker": "AAA", "de": float("nan"), "ben": None, "note": "ok"}])
    assert rows == [{"ticker": "AAA", "de": None, "ben": None, "note": "ok"}]


def test_build_payload_converts_integer_columns_to_python_int():
    rows = rest.build_payload([{"ticker": "AAA", "emissions_year": 2023.0, "year": None, "fiscal_year": np.int64(2022)}])
    assert rows == [{"ticker": "AAA", "emissions_year": 2023, "year": None, "fiscal_year": 2022}]
    assert isinstance(rows[0]["emissions_year"], int)
    assert isinstance(rows[0]["fiscal_year"], int)


def test_build_payload_flags_pipe_string_to_json_list():
    rows = rest.build_payload(
        [
            {"ticker": "A", "flags": "scope2-imputed|category-split-no-peers"},
            {"ticker": "B", "flags": ""},
            {"ticker": "C", "flags": float("nan")},
            {"ticker": "D", "flags": None},
            {"ticker": "E", "flags": ["already-a-list"]},
        ]
    )
    assert rows[0]["flags"] == ["scope2-imputed", "category-split-no-peers"]
    assert rows[1]["flags"] == []
    assert rows[2]["flags"] == []
    assert rows[3]["flags"] == []
    assert rows[4]["flags"] == ["already-a-list"]


def test_build_payload_strips_numpy_scalar_types_from_a_real_dataframe():
    df = pd.DataFrame({"ticker": ["A"], "tco2e": [1234.5], "year": [2023]})
    rows = rest.build_payload(df.to_dict("records"))
    assert rows == [{"ticker": "A", "tco2e": 1234.5, "year": 2023}]
    for value in rows[0].values():
        assert type(value) in (str, int, float)


def test_build_payload_raises_on_unserialisable_value():
    class Weird:
        pass

    with pytest.raises(TypeError):
        rest.build_payload([{"ticker": "A", "x": Weird()}])


# --- batched --------------------------------------------------------------------------------


def test_batched_splits_into_chunks_of_default_size():
    rows = list(range(1200))
    chunks = list(rest.batched(rows))
    assert [len(c) for c in chunks] == [500, 500, 200]
    assert sum(chunks, []) == rows


def test_batched_custom_size():
    assert list(rest.batched([1, 2, 3, 4, 5], size=2)) == [[1, 2], [3, 4], [5]]


# --- upsert / insert / delete_all / count: URL and header formation -------------------------


def test_upsert_posts_with_on_conflict_and_merge_duplicates_header():
    session = FakeSession()
    sent = rest.upsert(session, "https://x.supabase.co", {"apikey": "k"}, "nz_company_inputs", [{"ticker": "A"}], ["ticker"])
    assert sent == 1
    method, url, headers, body = session.calls[0]
    assert method == "POST"
    assert url == "https://x.supabase.co/rest/v1/nz_company_inputs?on_conflict=ticker"
    assert headers["Prefer"] == "resolution=merge-duplicates,return=minimal"
    assert headers["apikey"] == "k"
    assert body == [{"ticker": "A"}]


def test_upsert_uses_comma_joined_composite_keys():
    session = FakeSession()
    rest.upsert(session, "https://x.supabase.co", {}, "nz_emissions_sources", [{"ticker": "A"}], ["ticker", "source", "category"])
    _, url, _, _ = session.calls[0]
    assert url.endswith("?on_conflict=ticker,source,category")


def test_upsert_batches_rows_over_500():
    session = FakeSession()
    rows = [{"ticker": str(i)} for i in range(1001)]
    sent = rest.upsert(session, "https://x.supabase.co", {}, "t", rows, ["ticker"])
    assert sent == 1001
    assert len(session.calls) == 3
    assert [len(c[3]) for c in session.calls] == [500, 500, 1]


def test_upsert_skips_request_when_no_rows():
    session = FakeSession()
    assert rest.upsert(session, "https://x.supabase.co", {}, "t", [], ["ticker"]) == 0
    assert session.calls == []


def test_insert_posts_without_on_conflict_and_return_minimal():
    session = FakeSession()
    sent = rest.insert(session, "https://x.supabase.co", {"apikey": "k"}, "nz_segments", [{"ticker": "A"}])
    assert sent == 1
    method, url, headers, body = session.calls[0]
    assert method == "POST"
    assert url == "https://x.supabase.co/rest/v1/nz_segments"
    assert headers["Prefer"] == "return=minimal"


def test_delete_all_targets_ticker_not_null_by_default():
    session = FakeSession()
    rest.delete_all(session, "https://x.supabase.co", {"apikey": "k"}, "nz_emissions_sources")
    method, url, headers, _ = session.calls[0]
    assert method == "DELETE"
    assert url == "https://x.supabase.co/rest/v1/nz_emissions_sources?ticker=not.is.null"
    assert headers["apikey"] == "k"


def test_delete_all_custom_column():
    session = FakeSession()
    rest.delete_all(session, "https://x.supabase.co", {}, "t", ticker_column="list")
    _, url, _, _ = session.calls[0]
    assert url.endswith("?list=not.is.null")


def test_count_parses_content_range_and_sends_range_and_prefer_headers():
    session = FakeSession(FakeResponse(headers={"Content-Range": "0-0/503"}))
    n = rest.count(session, "https://x.supabase.co", {"apikey": "k"}, "nz_company_inputs", "ticker")
    assert n == 503
    method, url, headers, _ = session.calls[0]
    assert method == "GET"
    assert url == "https://x.supabase.co/rest/v1/nz_company_inputs?select=ticker"
    assert headers["Prefer"] == "count=exact"
    assert headers["Range"] == "0-0"


def test_count_handles_star_slash_n_form():
    session = FakeSession(FakeResponse(headers={"Content-Range": "*/0"}))
    assert rest.count(session, "https://x.supabase.co", {}, "nz_mac_costs", "category") == 0
