# Decisions log — Part 2 Net-Zero Scenario Tool

`Final_Part_2.pdf` is the reference. Every rule below is either a decision taken with the team
or a gap the PDF leaves open. Changes to PDF sections 4, 7, 8 or 9 must be recorded here with what
changed and why (PDF footer). Newest entries at the bottom; never rewrite old entries.

## Decisions (13 Sep 2026, brainstorming)

| ID | Decision | Why |
|---|---|---|
| D1 | Min-max normalisation within GICS sector | PDF §7 and §12 reproduce exactly (weights 0.29/0.42/0.29) |
| D2 | Spec and plan docs live only in `docs/superpowers/` on `part-2`; each phase branch `nz/pN-*` is cut from and merged back into `part-2`, never merged to `main` by us | User requirement |
| D3 | Python pipeline builds inputs; TypeScript engine runs in the browser | §8 and §10 need live overrides |
| D4 | Raw emissions data stored in Supabase too (long-format source table) | User requirement; every number traceable |
| D5 | DE/BEN: SEC bulk segment tags → Gemini classification → segment-note reads → sector median + flag | Cheapest path faithful to §5 |
| D6 | Gemini 2.5 Flash free tier, temperature 0, JSON schema, cached | $0 |
| D7 | Utilities: generation revenue × 10-K fuel mix (fossil → DE, renewable → BEN) | Segment revenue cannot split generation by fuel |
| D8 | Earnings = sum of last 4 reported quarters | §4 needs annual EBITDA |
| D9 | MAC values researched from IEA/McKinsey; out-of-range figures need team approval | §4 requires confirmation |
| D10 | Emissions: GHGRP (US) + Climate TRACE (non-US) + Wikirate Scope 2 | §4 sources |
| D11 | Missing Scope 2 → sector-median intensity × revenue; no emissions → sector-median TBR; flagged | Mirrors §5 imputation |
| D12 | Fleets from 10-K fuel disclosures × EPA Emission Factors Hub 2025 | Climate TRACE has no owner-level fleets |
| D13 | Climate TRACE: verified owner only, non-US, equal split across distinct owners | API has no ownership share |
| D14 | Wikirate-only Scope 1: fleet first, remainder by sector-median category shares | Avoids double counting |
| D15 | Long-only tilt amount: decile → 0, rest of bottom quintile cut by distance ÷ max distance | §9.2 does not state the amount |
| D16 | Benchmark = market cap × float ratio; market cap if ratio < 0.5 | yfinance float broken for dual-class shares |
| D17 | Explanations are deterministic templates, no LLM | Numbers always match the engine |
| D18 | `/portfolio` is public | Judges open it without an account |

## Gap rules (engine)

| Rule | Value |
|---|---|
| Near-zero EBITDA | EBITDA ≤ 0 or EBITDA ÷ revenue < 1% → TBR = sector 97.5th percentile, flagged; the revenue-margin leg only applies when revenue > 0 (EBITDA ≤ 0 alone is always near-zero regardless of revenue) |
| Sector with no valid TBR | TBR = 0 for every company in the sector, flagged `tbr-no-sector-data` |
| Missing EBITDA | TBR = sector median, flagged |
| Missing ND/EBITDA or FCF margin | sector median, flagged |
| topPercent | `ceil(rank ÷ N × 100)` |
| Sector with fewer than 2 companies | entropy is undefined (n < 2), so weights fall back to equal shares across variables |
| MAC category missing from `nz_mac_costs` | falls back to the PDF §12 mid-point for that category (scope2 30 / combustion 120 / fleet 200 / process 150 / fugitive 15) |
| EBITDA ≤ 0 with net debt > 0 | leverage distance = worst (max) among the sector's other rows, flagged `leverage-negative-ebitda` (not median-imputed, so negative EBITDA cannot look average on leverage); EBITDA ≤ 0 with net debt ≤ 0 (net cash) keeps the existing median imputation, flagged `leverage-imputed` |
| Constant normalised column | all 1 (weight 0) |
| Constant-column divergence below 1e-12 | treated as 0 (`WEIGHT_EPSILON`), so the cap relaxes correctly and dead columns cannot absorb capped excess |
| Weight cap infeasible | cap relaxed to 1 ÷ number of non-zero variables, logged |
| Quantiles | linear interpolation |
| Names per side (long/short) | ceil(N ÷ 5), min 2, max 5; sectors under 4 names split in half |
| Long/short cap excess | name cap → within leg; sector cap → other sectors ∝ score IQR; remainder cash |
| Long/short zero-dispersion sector | skips tradeable sectors whose score IQR is 0 (no dispersion to trade); their allotment stays in cash and is logged |
| Long/short name and sector caps | measured against the 200% target gross, not the book's actual gross; unallocated capital stays in cash, so actual gross can be lower and a name can exceed 3% of actual gross |
| Long-only quintile / decile | ceil(N ÷ 5) / ceil(N ÷ 10) |
| Small sectors | quintile q = ceil(N/5) reduced to floor(N/2) when 2q > N; decile d = min(ceil(N/10), q) |
| Long-only tilt excess | excess that cannot be placed in the top quintile within limits goes to middle names by benchmark weight, then back to the bottom quintile (spec D15 says pro-rata within sector) |
| Benchmark name above 5% | kept at benchmark (sector weight must hold), logged |
| Exclusion comparison missing emissions | never removes companies without emissions data (they cannot be ranked by emissions) |
| Dirichlet concentration | α = 100 × entropy weight, seed 42, 1,000 draws |
| Survival | all = same direction in every MAC run; most = at least half; few = fewer |
| Robust pick | survives all MAC runs and ≥ 90% of weight draws |
| Long-only pick threshold | a position counts as a pick for the sensitivity test only once its active weight reaches 1bp (0.0001); smaller tilts are treated as noise |
| Halving flipped positions | trims the opposite leg to keep neutrality (gross falls) rather than re-scaling the halved leg up |
| Stress-test weight draws | Dirichlet weight draws in the stress test are not re-capped at 0.40 (they perturb the capped entropy weights) |

## P9 portfolio page (13 Sep 2026)

| Rule | Value |
|---|---|
| Active share (long-only) | Σ \|portfolio − benchmark\| ÷ 2 |
| Stress results and the book | When a stress result exists for the current costs, mandate and thresholds, positions that flip under ±50% costs are halved in the stressed mandate's book and the CSV, not the other book (PDF §11); capital changes do not invalidate the result |
| Stress run | 1,000 Dirichlet draws, seed 42, run on button press in the browser (~0.5 s for 503 companies) |
| Cost scenario control | low / mid / high columns of `nz_mac_costs`; missing categories fall back to confirmed mid-points (maps/mac_costs.csv) with a warning |
| DE/BEN banner | Shown only when every company is unclassified (P4 not loaded) |
| Book-limit basis | Long/short name/sector limits are measured against the 200% target gross; fewer tradeable sectors means more cash and lower actual gross, stated on the method tab |
| Validation card | Shows "not available" when the 2019 validation check has n = 0 or spearman = null (P4/validation data not loaded), instead of implying a check was run |
| CSV | `toCsv` columns; file `nz-portfolio-<mandate>.csv`; long/short weights and dollars negative for shorts |

## Hand checks

Record each check as: date, what was checked, sample, result, action.

### [decision] Engine fallback MAC mid-points match maps/mac_costs.csv
- **Rule:** When `nz_mac_costs` is missing a category, the engine falls back to scope2 20, combustion 120, fleet 200, process 150, fugitive 20 USD/t — the confirmed mid-points in `data/pipeline/nz/maps/mac_costs.csv`.
- **Why:** The earlier placeholders (scope2 30, fugitive 15) predated the MAC research; keeping them would make bills differ depending on whether the Supabase load succeeded.
