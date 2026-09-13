"""SEC access shared by the fleet and segment scripts. SEC requires a User-Agent with contact details."""
import os
import time

import requests

COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
MIN_INTERVAL_SECONDS = 0.15  # SEC allows 10 requests per second


def normalise_ticker(ticker: str) -> str:
    return str(ticker).replace("-", ".").upper()


def build_cik_map(company_tickers: dict) -> dict[str, int]:
    return {normalise_ticker(v["ticker"]): int(v["cik_str"]) for v in company_tickers.values()}


class SecClient:
    def __init__(self, user_agent: str, session=None, sleep=time.sleep):
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = user_agent
        self.sleep = sleep

    def get(self, url: str):
        self.sleep(MIN_INTERVAL_SECONDS)
        response = self.session.get(url, timeout=120)
        response.raise_for_status()
        return response

    def cik_map(self) -> dict[str, int]:
        return build_cik_map(self.get(COMPANY_TICKERS_URL).json())

    def submissions(self, cik: int) -> dict:
        return self.get(SUBMISSIONS_URL.format(cik=int(cik))).json()


def client_from_env() -> SecClient:
    user_agent = os.environ.get("SEC_USER_AGENT")
    if not user_agent:
        raise SystemExit("Set SEC_USER_AGENT to 'hackathon-starter nz pipeline <contact email>' (SEC requires contact details).")
    return SecClient(user_agent)
