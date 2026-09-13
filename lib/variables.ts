// The 7 confirmed scoring variables (blueprint section 11). Shared
// between the leaderboard (weight vector, correlation matrix) and the
// company detail page (decomposition bars, raw-value table).
export const AXES = [
  {
    key: "env_intensity",
    label: "Emissions intensity",
    unit: "tCO2e / USD million revenue (log-transformed)",
    source: "EPA GHGRP, falling back to Wikirate/GRI",
    direction: "cost",
  },
  {
    key: "esg_risk",
    label: "ESG risk score",
    unit: "0-40, vendor scale",
    source: "Sustainalytics (Kaggle S&P 500 ESG Risk Ratings)",
    direction: "cost",
  },
  {
    key: "controversy",
    label: "Controversy level",
    unit: "0-5 ordinal",
    source: "Sustainalytics (Kaggle S&P 500 ESG Risk Ratings)",
    direction: "cost",
  },
  {
    key: "asset_turnover",
    label: "Asset turnover",
    unit: "revenue / total assets",
    source: "Quarterly financials",
    direction: "benefit",
  },
  {
    key: "profit_margin",
    label: "Net margin",
    unit: "net income / revenue",
    source: "Quarterly financials",
    direction: "benefit",
  },
  {
    key: "fcf_margin",
    label: "FCF margin",
    unit: "free cash flow / revenue",
    source: "Quarterly financials",
    direction: "benefit",
  },
  {
    key: "leverage",
    label: "Net debt / EBITDA",
    unit: "x, target 1.5",
    source: "Quarterly financials",
    direction: "target",
  },
] as const;

export type AxisKey = (typeof AXES)[number]["key"];
