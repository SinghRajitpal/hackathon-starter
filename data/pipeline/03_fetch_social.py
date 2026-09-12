"""
Social variables: total employee count (live, yfinance) and a reputation/
ethical proxy (Kaggle S&P 500 ESG Risk Ratings dataset -- Yahoo's own live
ESG/sustainability endpoint was discontinued, confirmed dead as of this
pipeline's build date).

Output: data/out/social.csv -- exactly one row per ticker, nulls where a
figure couldn't be retrieved (including the whole controversy column if the
Kaggle raw file hasn't been downloaded yet -- this script degrades gracefully
so employee counts can ship before Kaggle auth is set up).
"""
import os
import time

import pandas as pd
import yfinance as yf

UNIVERSE_PATH = "../out/universe.csv"
OUT_PATH = "../out/social.csv"
SLEEP_SECONDS = 0.3

KAGGLE_DATASET = "pritish509/s-and-p-500-esg-risk-ratings"
KAGGLE_RAW_DIR = "../raw/esg_risk_ratings"
KAGGLE_CSV_CANDIDATES = [
    "SP 500 ESG Risk Ratings.csv",
    "sp500_esg_risk_ratings.csv",
]


def fetch_employees(tickers: list[str]) -> pd.DataFrame:
    rows = []
    for i, ticker in enumerate(tickers, start=1):
        employees = None
        error = None
        try:
            info = yf.Ticker(ticker).info
            employees = info.get("fullTimeEmployees")
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
        rows.append({"ticker": ticker, "full_time_employees": employees, "employees_fetch_error": error})
        if i % 25 == 0 or i == len(tickers):
            print(f"[employees {i}/{len(tickers)}] {ticker}")
        time.sleep(SLEEP_SECONDS)
    return pd.DataFrame(rows)


def download_kaggle_dataset() -> str | None:
    """Downloads the ESG risk ratings dataset via the Kaggle API if credentials
    are present. Returns the path to the extracted CSV, or None if unavailable."""
    kaggle_creds = os.path.expanduser("~/.kaggle/kaggle.json")
    if not os.path.exists(kaggle_creds):
        print(f"No Kaggle credentials at {kaggle_creds} -- skipping controversy/reputation data")
        return None

    from kaggle.api.kaggle_api_extended import KaggleApi

    api = KaggleApi()
    api.authenticate()
    os.makedirs(KAGGLE_RAW_DIR, exist_ok=True)
    api.dataset_download_files(KAGGLE_DATASET, path=KAGGLE_RAW_DIR, unzip=True)

    for name in KAGGLE_CSV_CANDIDATES:
        candidate = os.path.join(KAGGLE_RAW_DIR, name)
        if os.path.exists(candidate):
            return candidate

    csvs = [f for f in os.listdir(KAGGLE_RAW_DIR) if f.lower().endswith(".csv")]
    if csvs:
        return os.path.join(KAGGLE_RAW_DIR, csvs[0])

    print("Kaggle dataset downloaded but no CSV found in it")
    return None


def normalize_ticker(ticker: str) -> str:
    return str(ticker).strip().upper().replace(".", "-")


def load_reputation_proxy() -> pd.DataFrame:
    csv_path = download_kaggle_dataset()
    if csv_path is None:
        return pd.DataFrame(columns=["ticker", "controversy_level", "total_esg_risk_score"])

    raw = pd.read_csv(csv_path)
    symbol_col = next((c for c in raw.columns if c.strip().lower() == "symbol"), raw.columns[0])
    controversy_col = next((c for c in raw.columns if "controvers" in c.lower()), None)
    esg_score_col = next((c for c in raw.columns if "total esg" in c.lower()), None)

    out = pd.DataFrame({"ticker": raw[symbol_col].map(normalize_ticker)})
    out["controversy_level"] = raw[controversy_col] if controversy_col else None
    out["total_esg_risk_score"] = raw[esg_score_col] if esg_score_col else None

    out = out.drop_duplicates(subset="ticker", keep="first")
    return out


def main():
    universe = pd.read_csv(UNIVERSE_PATH)
    tickers = universe["ticker"].tolist()

    employees_df = fetch_employees(tickers)
    reputation_df = load_reputation_proxy()

    df = employees_df.merge(reputation_df, on="ticker", how="left")

    assert df["ticker"].is_unique, "social must have exactly one row per ticker"
    missing = set(universe["ticker"]) - set(df["ticker"])
    assert not missing, f"missing tickers from social output: {missing}"

    df.to_csv(OUT_PATH, index=False)
    n_with_controversy = df["controversy_level"].notna().sum() if "controversy_level" in df else 0
    print(f"Wrote {len(df)} rows to {OUT_PATH} ({n_with_controversy} with controversy data)")


if __name__ == "__main__":
    main()
