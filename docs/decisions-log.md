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
| D6 | Gemini 3.5 Flash (2.5 Flash unavailable to new API keys), temperature 0, JSON schema, no thinking tokens, cached responses | $0 / cheapest viable |
| D7 | Utilities: generation revenue × 10-K fuel mix (fossil → DE, renewable → BEN) | Segment revenue cannot split generation by fuel |
| D8 | Earnings = sum of last 4 reported quarters | §4 needs annual EBITDA |
| D9 | MAC values researched from IEA/McKinsey; out-of-range figures need team approval. Confirmed 2026-09-13: scope2 mid=20 USD/t sourced from McKinsey Global Energy Perspective 2025 (power-sector decarbonization cost curve); fugitive mid=20 USD/t sourced from IEA Global Methane Tracker 2025 — both inside the PDF §4 range, no approval needed. Combustion, process and fleet retain the PDF §4 indicative mid-points (120/150/200) — no in-range confirming public figure was found for those abatement routes. Out-of-range literature was found but not used, noted for the method tab only: green-hydrogen heat abatement ≈ USD 500–1,250/t (far above the combustion range); cement/steel CCUS abatement ≈ USD 33–120/t (below the process floor). Full research notes and URLs kept alongside the MAC research working files. | §4 requires confirmation |
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
| Long-only quintile / decile | ceil(N ÷ 5) / ceil(N ÷ 10) |
| Benchmark name above 5% | kept at benchmark (sector weight must hold), logged |
| Dirichlet concentration | α = 100 × entropy weight, seed 42, 1,000 draws |
| Survival | all = same direction in every MAC run; most = at least half; few = fewer |
| Robust pick | survives all MAC runs and ≥ 90% of weight draws |

## P1 data rules (13 Sep 2026)

| Rule | Value |
|---|---|
| GHGRP unattributed remainder | 21 of 6,470 facilities in 2023 (22 of 6,580 in 2019) report totals above their subpart columns (0.014% of emissions). Categories define the total; the remainder is dropped and printed by `11_ghgrp_categories.py`. |
| Fleet fuel not disclosed | Companies whose 10-K states no fuel volumes (e.g. UPS) get no fleet emissions and the flag `fleet-fuel-not-disclosed`. Known limitation: their burden is understated. |
| Emission factors | Constants in `nzlib/fleet.py` citing EPA GHG Emission Factors Hub 2025 Table 2 (kg CO2 per gallon: jet fuel 9.75, aviation gasoline 8.31, diesel 10.21, gasoline 8.78, LPG 5.68, residual fuel oil 11.27; CNG 0.05444 per scf). No `emission_factors.csv`. |
| Fleet with GHGRP | GHGRP has no mobile sources, so 10-K fleet emissions are added on top of GHGRP categories. |

## P4 model note (13 Sep 2026)

- [decision] Segment notes and classification run on gemini-3.5-flash-lite: free-tier daily quota of 20 requests for gemini-3.5-flash was exhausted; user chose flash-lite; lower accuracy risk mitigated by the ~10% hand-check.

## Hand checks

Record each check as: date, what was checked, sample, result, action.
