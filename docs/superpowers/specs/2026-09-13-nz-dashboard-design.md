# Net-Zero Risk Dashboard (Part 2 reshape) — Design

Date: 2026-09-13 · Branch: `part-2` (never reaches `main`) · Builds on `2026-09-13-net-zero-scenario-design.md` (engine unchanged).

## Goal

Turn the working Part 2 prototype into a simple, professional, terminal-style dashboard that answers the five questions a fund manager asks about a surprise net-zero commitment: where is the risk (market), who wins inside an industry (sector), how hard is one company hit and can it pay (company), what should my USD 1B hold for my risk appetite (portfolio), and what if the assumptions are wrong (robustness headline).

## Layout

One dashboard at `/` (`/portfolio` redirects to `/?view=portfolio`). A top bar on every screen: command box (type a ticker → COMPANY, a sector name → SECTOR), four screen tabs MARKET · SECTOR · COMPANY · PORTFOLIO, the active risk preset, and an "i" button that opens the method/limitations drawer. Every screen has the same frame: one row of 3–5 number tiles, one main table or visual, and a "Key takeaways" box of at most 3 generated sentences. Numbers are tabular; colour only marks verdicts. Visual polish is deferred to the later UI session.

## Screens

- **MARKET** — tiles: index cleanup bill ($bn and years of index EBITDA), fossil revenue share, green revenue share, sectors to pick winners in. Table per sector: cleanup cost (years), fossil %, green %, winner/loser gap (TBR IQR), verdict `Pick winners here` (tradeable) · `Whole sector hit` (not tradeable and fossil ≥ 50% or cleanup ≥ 0.1 years) · `Barely affected`.
- **SECTOR** — tiles for the sector; companies ranked by net-zero readiness (scenario score) with cleanup cost, revenue at risk (DE), revenue upside (BEN), debt load, Leader / Middle / Laggard (top / bottom quintile by rank), fund action (active weight). Takeaway compares leaders' and laggards' cleanup cost in months of earnings.
- **COMPANY** — verdict header ("Laggard · bottom 20% of Utilities"), score and rank; four tiles against the sector median: cleanup cost, revenue at risk, revenue upside, can it pay (debt load, FCF margin); peer strip; bill split by the five sources; reason sentence (existing template); fund stance; badges "Holds under ±50% costs" and "Data: reported / estimated".
- **PORTFOLIO** — three onboarding questions pick a preset; tiles and a comparison table for portfolio vs S&P 500 vs exclusion: weighted cleanup burden, fossil revenue share, green revenue share, carbon cost per USD 1M, active share; sector active-weight bars; top 10 overweights and underweights with reasons; robustness headline; CSV; long/short book only when the preset allows shorts; "Adjust" drawer for capital and cost scenario (PDF §10 inputs).

## Risk presets (user-approved)

| | Conservative | Balanced (PDF defaults) | Aggressive |
|---|---|---|---|
| TBR IQR threshold | 0.25 yrs | 0.25 yrs | 0.05 yrs |
| Score IQR threshold | 25 | 25 | 25 |
| Active weight limit per name | ±1pp | ±2pp | ±3pp |
| Robust picks only | from answer | from answer | from answer |
| Long/short book | no | no | if shorting allowed |

Onboarding: (1) "How far may the fund trail the S&P 500 in a bad year?" under 1% → Conservative, up to 3% → Balanced, more → Aggressive; (2) "May the fund short stocks?"; (3) "Only trade picks that hold if cleanup costs are 50% off?" Default answers give Balanced = the PDF. Changes to PDF §8/§9 behaviour (preset thresholds, active limit, robust-only filter: non-robust picks held at benchmark with the sector kept at benchmark weight) are logged in `docs/decisions-log.md`.

## Cut from the screens

Current ticker panel sections and the five portfolio tabs, entropy weights and IQR jargon, flag lists (→ data badge), raw inputs table, manual stress button (stress runs with the preset), the full 500-row table (behind "show all"), method and the 2019 check (→ "i" drawer). Data pipeline frozen.

## Must work

Command box → COMPANY for any ticker; MARKET → SECTOR → COMPANY drill-down; onboarding → PORTFOLIO; changing preset changes traded sectors and headline tiles; CSV matches the screen; tests, lint and build pass; browser check with no console errors.
