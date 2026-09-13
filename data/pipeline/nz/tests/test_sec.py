import pytest

from nzlib import sec


def test_cik_map_normalises_class_share_tickers():
    raw = {"0": {"cik_str": 1067983, "ticker": "BRK-B", "title": "Berkshire"}, "1": {"cik_str": 34088, "ticker": "xom", "title": "Exxon"}}
    assert sec.build_cik_map(raw) == {"BRK.B": 1067983, "XOM": 34088}
    assert sec.normalise_ticker("BRK-B") == "BRK.B"


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self):
        self.headers = {}
        self.urls = []

    def get(self, url, timeout):
        self.urls.append(url)
        return FakeResponse({"filings": {"recent": {}}})


def test_client_sends_user_agent_throttles_and_formats_submissions_url():
    session = FakeSession()
    sleeps = []
    client = sec.SecClient("nz pipeline test@example.com", session=session, sleep=sleeps.append)
    assert client.submissions(34088) == {"filings": {"recent": {}}}
    assert session.headers["User-Agent"] == "nz pipeline test@example.com"
    assert session.urls == ["https://data.sec.gov/submissions/CIK0000034088.json"]
    assert sleeps == [sec.MIN_INTERVAL_SECONDS]


def test_client_from_env_requires_user_agent(monkeypatch):
    monkeypatch.delenv("SEC_USER_AGENT", raising=False)
    with pytest.raises(SystemExit):
        sec.client_from_env()
