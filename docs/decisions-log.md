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
| Stress results and the book | When a stress result exists for the current costs, mandate and thresholds, positions that flip under ±50% costs are halved in both books and the CSV (PDF §11); capital changes do not invalidate the result |
| Stress run | 1,000 Dirichlet draws, seed 42, run on button press in the browser (~0.5 s for 503 companies) |
| Cost scenario control | low / mid / high columns of `nz_mac_costs`; missing categories fall back to PDF §12 mid-points with a warning |
| DE/BEN banner | Shown only when every company is unclassified (P4 not loaded) |
| Book-limit basis | Long/short name/sector limits are measured against the 200% target gross; fewer tradeable sectors means more cash and lower actual gross, stated on the method tab |
| Validation card | Shows "not available" when the 2019 validation check has n = 0 or spearman = null (P4/validation data not loaded), instead of implying a check was run |
| CSV | `toCsv` columns; file `nz-portfolio-<mandate>.csv`; long/short weights and dollars negative for shorts |

## P1 data rules (13 Sep 2026)

| Rule | Value |
|---|---|
| GHGRP unattributed remainder | 21 of 6,470 facilities in 2023 (22 of 6,580 in 2019) report totals above their subpart columns (0.014% of emissions). Categories define the total; the remainder is dropped and printed by `11_ghgrp_categories.py`. |
| Fleet fuel not disclosed | Companies whose 10-K states no fuel volumes (e.g. UPS) get no fleet emissions and the flag `fleet-fuel-not-disclosed`. Known limitation: their burden is understated. |
| Emission factors | Constants in `nzlib/fleet.py` citing EPA GHG Emission Factors Hub 2025 Table 2 (kg CO2 per gallon: jet fuel 9.75, aviation gasoline 8.31, diesel 10.21, gasoline 8.78, LPG 5.68, residual fuel oil 11.27; CNG 0.05444 per scf). No `emission_factors.csv`. |
| Fleet with GHGRP | GHGRP has no mobile sources, so 10-K fleet emissions are added on top of GHGRP categories. |
| Climate TRACE sources | v7, year 2024, gas co2e_100yr; non-US only; verified owner; equal split over distinct owners (D13). |
| Climate TRACE owner map | Top 20 candidate-sector emitters (by `scope1_tco2e`) hand-checked on 2026-09-13 by Claude Code session (user pre-approved); 15 of 20 accepted (with named JV/subsidiary exclusions for CVX and CMS), 5 (SO, AEP, PPL, AEE, WEC) had no valid Climate TRACE owner match; XOM added via a controller-verified owner id; other rows only for a single exact normalised-name match. |
| Emissions precedence | GHGRP categories (+ Climate TRACE non-US, + 10-K fleet) → reported Scope 1 total split by sector-median GHGRP shares after fleet (no Climate TRACE) → Climate TRACE only (+ fleet) → fleet only → none. |
| Scope 2 imputation scope | Only companies with some Scope 1 data get imputed Scope 2; companies with no emissions in any source keep every category empty so the engine applies the sector-median TBR (D11). |
| Total without sector peers | A reported Scope 1 total in a sector with no GHGRP-split companies goes entirely to combustion, flag `category-split-no-peers`. |
| GHGRP reconciliation check (Task 12 ruling) | The tautological "GHGRP categories sum to GHGRP total within 0.1%" check is replaced by a per-ticker check: `\|reported_total − total\| ÷ reported_total ≤ 0.5%` using `ghgrp_categories.csv` year-2023 rows (extra `reported_total` column = EPA's own total). Exceptions are printed; `check_inputs.py` fails only when more than 5 tickers exceed the threshold. |
| Optional emissions inputs (Task 12) | `ct_categories.csv` and `fleet.csv` (and `ghgrp_categories.csv`) are optional inputs to `17_build_inputs.py`: a missing file is treated as an empty source (no Climate TRACE non-US emissions, no 10-K fleet) and logged as "missing optional input", not a failure. |
| Supabase loader (Task 13 ruling) | Loader uses Supabase REST with the service key (no DB password); child tables refreshed by delete then insert (not transactional). |
| Climate TRACE basin aggregates excluded (P1 fix, 13 Sep 2026) | `oil-and-gas-production` / `oil-and-gas-transport` sources named `Country_Basin_Type` (e.g. `Qatar_Rub al Khali_LNG`, 56.6 Mt, 3 owners) are country-basin aggregates of many wells/fields, not a single asset. D13's equal split assumes a verified owned asset; a basin aggregate is not one, so `12_climate_trace.py` now excludes them via `nzlib.climate_trace.is_basin_aggregate` before the ownership-confirmation call, logs the excluded count/tonnage, and flags any affected ticker `ct-basin-aggregate-excluded`. Before the fix these ~180 Mt of the ~238 Mt attributed inflated OXY (~61 Mt), CVX (~51 Mt) and XOM (~66 Mt) non-US fugitive. |
| Climate TRACE US territories (P1 fix, 13 Sep 2026) | PRI, GUM, VIR, ASM and MNP are now treated as US alongside USA in the Climate TRACE non-US filter, since GHGRP already covers US territories; keeping PRI as "non-US" double-counted AES Puerto Rico (+6.42 Mt). |
| Climate TRACE fleet vs 10-K fleet (P1 fix, 13 Sep 2026) | `merge_emissions.add_ct()` no longer adds Climate TRACE's own `fleet` key when a 10-K fleet value is present (D12's 10-K fleet takes precedence); it was being added on top of the 10-K figure, double counting fleet emissions. |
| Climate-TRACE-only Scope 1 (P1 fix, 13 Sep 2026) | The Climate-TRACE-only branch of `merge_emissions` (no GHGRP) now also flags `scope1-us-missing`, since that branch carries only non-US Climate TRACE assets and US Scope 1 is absent from it. No flag-label map exists in `lib/netzero`/components (flags render as a raw joined list), so no frontend label was added. |

| GHGRP parent-name join (fix-b ruling, 2026-09-13) | `attribute_to_tickers` now joins tickers to GHGRP parent names on a space-/punctuation-insensitive `match_key` on top of `normalize_name` (fixes misses like "ExxonMobil" vs "EXXON MOBIL CORP"), plus a hand-checked literal alias map (`maps/ghgrp_parent_aliases.csv`, columns ticker/ghgrp_parent_name/evidence) for names sharing no common key at all. `normalize_name` itself is unchanged so `12_climate_trace.py`'s exact-string comparisons are unaffected. |

| Float cap capped at the listed line (D16 addendum, fix pass 13 Sep 2026) | `nzlib.financials.float_cap` / new `cap_at_listed_line` also cap the D16 float-adjusted cap at `price × shares_outstanding` for the fetched ticker's own line, applied after the existing ratio/fallback step; idempotent (a flag already recording the cap short-circuits, so a repeat `--recap-only` cannot double-append it). Defect: yfinance `marketCap` is company-wide, but the pipeline pairs it with a per-class share count, so multi-class tickers were overstated — GOOGL and GOOG each counted near the whole-Alphabet cap, similarly FOX/FOXA, NWS/NWSA, BRK-B. Applied with no refetch via `10_ttm_financials.py --recap-only` (reads/writes only `float_cap`/`cap_flag` in `financials_ttm.csv`, no yfinance calls); 57/503 rows recapped, new flag `float-cap-capped-listed-line` (appended to any existing fallback flag). Before → after: GOOGL 4.14T → 1.99T; GOOG 4.10T → 1.85T; BRK-B 1.09T → 0.72T; IBKR 151B → 41.4B; NKE 53.4B → 44.2B. Full list also includes META, V, MA, DELL, MRVL, BX, HOOD, ABNB, UPS, DDOG, SPG, CVNA, F, VMRK, XYZ, COIN, EXC, WDAY, ARES, PAYX, EL, KR, HSY, EXPE, EXR, TKO, RDDT, FOXA, FISV, FOX, DRI, ECHO, RL, CHTR, ESS, LEN, TSN, NWS, NWSA, MAA, DOC, MKC, BF-B, PSKY, UDR, BXP, LULU, UHS, AOS, TTD. |
| Marine fuel metric-ton factor (fleet coverage fix, 13 Sep 2026) | `nzlib/fleet.py` adds `metric_tons` / `million_metric_tons` units. Defect: the unit list had no mass unit at all, so cruise lines that report bunker fuel in tonnes (CCL, RCL, NCLH) could never be extracted regardless of what the 10-K said. Factor is derived from data already in this file, not a new source: EPA GHG Emission Factors Hub 2025 Table 2 per-gallon CO2 factor (residual_fuel_oil 11.27 kg/gal → HFO, diesel 10.21 kg/gal → MGO/distillate) × gallons-per-tonne implied by ISO 8217:2017 marine fuel density (HFO/RMG-grade residual max density 991 kg/m³ = 0.991 kg/L; MGO/DMA-grade typical density 860 kg/m³ = 0.860 kg/L) → 3.004 tCO2/t (HFO), 3.136 tCO2/t (MGO). Cross-checked against IMO MEPC.1/Circ.684's published carbon factors (HFO 3.114, MGO/Diesel 3.206 tCO2/t fuel) — within ~4%, corroborating the derivation without importing IMO's separate factor set. When a company states one undifferentiated metric-ton figure (no fuel-type breakout, e.g. Carnival's "Fuel consumption in metric tons"), the extraction prompt classifies it as `residual_fuel_oil` (the HFO-equivalent factor), since bunker fuel is predominantly HFO/VLSFO by mass. Also added `metric tons?`-family patterns to `nzlib.edgar.FLEET_FUEL_PATTERNS` so the section finder does not depend on incidentally matching `fuel consum`. |
| Fleet fuel not disclosed — rechecked (fix pass 13 Sep 2026) | Fetched UNP, CSX, FDX and UPS's current 10-Ks directly (not just the cached excerpts already in `fleet.csv`) to check whether the prior `not-disclosed` status was a real absence or a prompt/section-finder miss. All four are a real absence, not a bug: UNP and CSX define only a fuel-efficiency ratio (gallons of fuel per gross ton-mile) with no absolute total anywhere in the filing; FedEx states SAF offtake agreements (future purchases) and a fuel-*savings* figure from efficiency programs, neither of which is total consumption; UPS discusses only fuel price/cost exposure. No code change was needed or made for these four. This reconfirms the rule above (`Fleet fuel not disclosed`): no imputation is added for missing fleet fuel — the spec (§4/§5/D12) does not state an imputation rule for it — non-disclosing companies keep `e_fleet` empty and get the `fleet-fuel-not-disclosed` flag downstream. |
| CCL/RCL/NCLH rerun blocked by Gemini quota (13 Sep 2026) | After the metric-ton fix, `13_fleet_fuel.py --tickers CCL,RCL,NCLH` was run to verify it live. All three failed with `RESOURCE_EXHAUSTED` (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20 requests/day for gemini-3.5-flash) — the day's free-tier quota was already spent before this run, confirmed by a direct API call reproducing the same 429 outside the pipeline. `fleet.csv` rows for CCL, RCL and NCLH are left as `status=error` (`Gemini rate limit persisted after 5 attempts`) rather than fabricated or reverted; the existing cache and throttle were used as-is per the fix's constraints (no config change). Manually reading CCL's 10-K directly (outside the pipeline) confirms it discloses "Fuel consumption in metric tons (in millions) 2.8" for FY2025 — with the fix, a successful rerun is expected to extract ≈2.8M t × 3.004 tCO2/t ≈ 8.41M tCO2e for CCL. RCL and NCLH were also read directly and disclose no actual annual consumption figure (only fuel-price hedge tables in metric tons and dollar fuel expense) — both are expected to remain `not-disclosed` even after a successful rerun. Action: rerun `13_fleet_fuel.py --tickers CCL,RCL,NCLH` once the daily quota resets. |

## Hand checks

Record each check as: date, what was checked, sample, result, action.

- 2026-09-13, `maps/ct_owner_candidates.csv` top 20 candidate-sector Scope 1 emitters (checked by: Claude Code session, user pre-approved), 15/20 accepted (Vistra, Duke Energy, NextEra, Xcel, Entergy, Phillips 66, Marathon Petroleum, Dominion, Evergy, Valero, NRG, DTE, CF Industries, Chevron, CMS Energy) and 5/20 rejected for no valid owner match (Southern Company, American Electric Power, PPL, Ameren, WEC Energy Group — candidates were either absent or unrelated look-alike companies, e.g. "Southern Kuzbass Coal Company PJSC" for Southern Company); action: Chevron Phillips / Chevron Phillips Chemical (50/50 JV) and Chevron USA Inc excluded from CVX's owner ids, and "CMS Cepcor Group Utah" / "Shuweihat CMS International Power" (divested JV) excluded from CMS's; 22 further tickers added beyond the top 20 only where `suggested_owner_ids` was a single exact normalised-name match; XOM added via a separately controller-verified owner id (E100000001213) since its `scope1_tco2e` is null in the universe file.
- 2026-09-13, `maps/ghgrp_parent_aliases.csv` candidate-sector tickers named in the fix-b defect report (APD, DD, NEM, CARR, ITW, IR, JCI, LII, TT, WAB, AZO, TGT) hand-checked against the EPA GHGRP parent-company file's `PARENT COMPANY NAME` strings for 2019 and 2023 (checked by: Claude Code session, user pre-approved). CARR, ITW, IR, JCI, LII, TT, AZO and TGT already join correctly under the existing name normaliser once space-insensitivity is added (see D-row above) or are correctly excluded by the existing ≥50%-ownership rule (ITW at 49%, NEM's 2023 "NEWMONT CORP" facilities at 38.5%) — none needed an alias, and none newly matched. 3/12 needed and got a hand-checked alias: APD → "AIR PRODUCTS & CHEMICALS INC" (100% owner of e.g. facility 1002121, sole "AIR PRODUCTS"-prefixed parent in either year), DD → "DUPONT DE NEMOURS INC" (100% owner of e.g. facility 1001715; "DUPONT TEIJIN FILMS" explicitly excluded as a JV DuPont sold to Teijin in 2019), WAB → "WABTEC US RAIL INC" (100% owner of facility 1004697, sole "WABTEC"-prefixed parent). Action: after the fix, `11_ghgrp_categories.py` newly matched APD, DD, WAB and XOM (both 2019 and 2023, XOM via the space-insensitive join alone, no alias needed) with reconciliation (`reported_total` vs categorised `total`) exact for all four; every pre-existing ticker-year row's values were verified unchanged (no regressions, no false positives introduced).


## §11 validation (P8, 13 Sep 2026)

2019 TBR (GHGRP Scope 1 categories × mid MAC ÷ FY2019 EBITDA from SEC companyfacts) against the change in
GHGRP Scope 1 intensity from 2019 to 2023 (latest revenue = TTM). n = 67, Spearman = -0.203.
Hypothesis (low burden → faster decarbonisation) predicts a positive correlation. Result: not supported.
Scope: US facilities only; companies without GHGRP rows in both years are excluded.


- 2026-09-13, float-cap ÷ (price × shares_outstanding) checked across all 503 rows of `financials_ttm.csv` before and after `10_ttm_financials.py --recap-only` (checked by: Claude Code session), before: 57 rows above 1.2× (up to 3.9x for GOOGL) — sample GOOGL 4.14T, GOOG 4.10T, BRK-B 1.09T, IBKR 151B, NKE 53.4B; result: after recap the max ratio across all 503 rows is 1.0000000000000002 (float rounding only), 0 rows remaining above 1.0; action: none further needed, CSV committed as `data:`.
- 2026-09-13, UNP, CSX, FDX, UPS 10-Ks fetched directly from EDGAR and searched for `gallons`/`fuel consum`/`metric ton` (checked by: Claude Code session), sample: full filing text (330k-600k characters each); result: none discloses an absolute fuel-consumption amount (UNP/CSX: ratio only; FDX: SAF offtake + savings figure only; UPS: price/cost narrative only) — the existing `not-disclosed` status is correct; action: none, no code change.
- 2026-09-13, `13_fleet_fuel.py --tickers CCL,RCL,NCLH` rerun after the metric-ton fix (checked by: Claude Code session), sample: 3 tickers, 15 Gemini calls (5 retries each); result: all 3 failed with 429 `RESOURCE_EXHAUSTED` (free-tier daily quota for gemini-3.5-flash, limit 20/day, already spent), reproduced independently outside the pipeline; action: left `fleet.csv` status as `error` for these 3 (not fabricated, not reverted); rerun once the daily quota resets.

### [decision] Engine fallback MAC mid-points match maps/mac_costs.csv
- **Rule:** When `nz_mac_costs` is missing a category, the engine falls back to scope2 20, combustion 120, fleet 200, process 150, fugitive 20 USD/t — the confirmed mid-points in `data/pipeline/nz/maps/mac_costs.csv`.
- **Why:** The earlier placeholders (scope2 30, fugitive 15) predated the MAC research; keeping them would make bills differ depending on whether the Supabase load succeeded.

## Hand checks (spec §9)

2026-09-13, checked by: Claude Code session (task-scoped, no web access). These three checks are reasonableness
checks against general knowledge of each company's business type, not reconciliations to company-reported
figures. The DE/BEN classification hand check (~10% sample) is deferred to the controller.

### Top 20 Scope 1 emitters — category-split plausibility

Ranked by Scope 1 total (combustion + fleet + process + fugitive) from `company_inputs.csv`; sources cross-checked against `emissions_sources.csv`.

| Rank | Ticker | Company | Sector / sub-industry | Combustion Mt | Fleet Mt | Process Mt | Fugitive Mt | Total Mt | Main source(s) | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | VST | Vistra | Utilities / Electric Utilities | 86.40 | 0 | 0 | 0 | 86.40 | GHGRP | Generator: combustion-dominant plausible |
| 2 | SO | Southern Company | Utilities / Electric Utilities | 75.75 | 0 | 0 | 0.46 | 76.21 | GHGRP | Generator: combustion-dominant plausible |
| 3 | DUK | Duke Energy | Utilities / Electric Utilities | 73.27 | 0 | 0 | 0.47 | 73.74 | GHGRP | Generator: combustion-dominant plausible |
| 4 | XOM | ExxonMobil | Energy / Integrated Oil & Gas | 25.10 | 0 | 32.85 | 7.38 | 65.33 | GHGRP + Climate TRACE | Integrated major with large non-US upstream: process/fugitive-heavy plausible |
| 5 | BRK-B | Berkshire Hathaway | Financials / Multi-Sector Holdings | 58.99 | 0 | 0.05 | 0.50 | 59.53 | GHGRP | Holding co.: combustion total consistent with consolidated Berkshire Hathaway Energy utility subsidiaries, plausible |
| 6 | AEP | American Electric Power | Utilities / Electric Utilities | 50.83 | 0 | 0 | 0.19 | 51.03 | GHGRP | Generator: combustion-dominant plausible |
| 7 | UAL | United Airlines | Industrials / Passenger Airlines | 0 | 45.46 | 0 | 0 | 45.46 | 10-K fleet | Airline: 100% fleet plausible |
| 8 | DAL | Delta Air Lines | Industrials / Passenger Airlines | 0.84 | 41.62 | 0.41 | 0 | 42.88 | 10-K fleet + GHGRP | Airline with owned refinery: fleet-dominant plus small combustion/process plausible |
| 9 | NEE | NextEra Energy | Utilities / Multi-Utilities | 40.50 | 0 | 0 | 0.47 | 40.96 | GHGRP | Generator: combustion-dominant plausible |
| 10 | XEL | Xcel Energy | Utilities / Multi-Utilities | 38.88 | 0 | 0 | 0.38 | 39.26 | GHGRP | Generator: combustion-dominant plausible |
| 11 | ETR | Entergy | Utilities / Electric Utilities | 35.76 | 0 | 0 | 0.11 | 35.88 | GHGRP | Generator: combustion-dominant plausible |
| 12 | PSX | Phillips 66 | Energy / Oil & Gas Refining & Marketing | 18.08 | 0 | 12.03 | 5.40 | 35.51 | GHGRP + Climate TRACE | Refiner: combustion + process mix plausible |
| 13 | D | Dominion Energy | Utilities / Multi-Utilities | 28.39 | 0 | 0 | 1.17 | 29.56 | GHGRP | Generator: combustion-dominant plausible |
| 14 | MPC | Marathon Petroleum | Energy / Oil & Gas Refining & Marketing | 20.18 | 0 | 8.27 | 0.35 | 28.80 | GHGRP | Refiner: combustion + process mix plausible |
| 15 | VLO | Valero Energy | Energy / Oil & Gas Refining & Marketing | 13.72 | 0 | 14.78 | 0 | 28.50 | GHGRP + Climate TRACE | Refiner: process-heavy split plausible |
| 16 | CVX | Chevron | Energy / Integrated Oil & Gas | 11.67 | 0 | 11.51 | 4.82 | 28.00 | GHGRP + Climate TRACE | Integrated major: balanced combustion/process/fugitive plausible |
| 17 | PPL | PPL Corporation | Utilities / Electric Utilities | 26.77 | 0 | 0 | 0.15 | 26.92 | GHGRP | Generator: combustion-dominant plausible |
| 18 | EVRG | Evergy | Utilities / Electric Utilities | 23.65 | 0 | 0 | 0.07 | 23.72 | GHGRP | Generator: combustion-dominant plausible |
| 19 | DTE | DTE Energy | Utilities / Multi-Utilities | 22.64 | 0 | 0.21 | 0.34 | 23.19 | GHGRP | Generator with small gas-midstream arm: combustion-dominant plus minor process plausible |
| 20 | CSCO | Cisco | Information Technology / Communications Equipment | 5.00 | 0 | 18.00 | 0 | 23.00 | Wikirate/GRI (`category-split-imputed`) | ⚠ Fabless networking-equipment vendor with a 78% "process" share is implausible. Likely cause: D14's `category-split-imputed` applied the sector-median GHGRP category shares of the few Information Technology peers that are semiconductor **fabs** (ADI, AVGO, AMD — real process emissions from chip manufacture) to Cisco's Wikirate global Scope 1 total; Cisco outsources manufacturing and should not carry a fab-like process share. Only the Wikirate *total* (~23 Mt) is trustworthy, not this split. |

Rows 1–19 read as plausible against each company's known business type; only row 20 (CSCO) is flagged.

### Climate TRACE owner map spot-check (10 of `ct_owner_map.csv`'s 39 rows)

| Ticker | Owner id(s) / name(s) | Same corporate parent? | Note |
|---|---|---|---|
| VST | Vistra Corp | Yes | Exact name match |
| DUK | Duke Energy Carolinas/Florida/Indiana/Kentucky/Progress/Ohio | Yes | All wholly owned Duke Energy operating subsidiaries |
| NEE | NextEra Energy Point Beach LLC | Yes, but thin | Only a single nuclear-plant subsidiary matched; NextEra's much larger fossil fleet has no Climate TRACE owner id here. Benign — GHGRP already covers NEE's domestic combustion and `company_inputs.csv` shows no ClimateTRACE line for NEE — but flagged as a coverage-completeness doubt, not a wrong-parent doubt |
| XEL | Xcel Energy Inc | Yes | Exact name match |
| ETR | Entergy Corp + Arkansas/Louisiana/Mississippi/Texas/New Orleans | Yes | All Entergy operating companies |
| PSX | Phillips 66 + Phillips 66 – Los Angeles refinery entity | Yes | Refinery entity is a Phillips 66 subsidiary |
| MPC | Marathon Petroleum Corp + Marathon Petroleum Company LP | Yes | LP is MPC's operating subsidiary |
| D | Dominion Energy South Carolina Inc | Yes | Former SCE&G, acquired by Dominion in 2019 |
| CVX | Chevron Corp + Nigeria/Argentina/Saudi Arabia/Brasil subsidiaries | Yes | JV (Chevron Phillips, 50/50) and US-only entity (Chevron USA) correctly excluded per prior controller ruling |
| CMS | CMS Generation Grayling/Genesee/Holdings/Filer City/Michigan Power | Yes | Non-utility subsidiaries; divested JVs (CMS Cepcor Group Utah, Shuweihat CMS International Power) correctly excluded |

Result: 10/10 confirmed same corporate parent. One doubt (NEE — thin coverage, not a wrong match); no wrong-parent matches found in this sample.

### MAC sources (`mac_costs.csv`, all 5 rows)

| Category | Low | Mid | High | Ordered (low≤mid≤high)? | Source | Date | Mid inside PDF §4 range? |
|---|---|---|---|---|---|---|---|
| scope2 | 0 | 20 | 50 | Yes | McKinsey Global Energy Perspective 2025 | 2025-01-01 | Yes (D9: confirmed 2026-09-13, in range) |
| combustion | 50 | 120 | 150 | Yes | Final_Part_2.pdf §4 indicative range (unconfirmed) | 2026-09-13 | Yes — value is the PDF §4/§12 mid-point itself (120) |
| fleet | 100 | 200 | 300 | Yes | Final_Part_2.pdf §4 indicative range (no public confirmation found) | 2026-09-13 | Yes — value is the PDF §4/§12 mid-point itself (200) |
| process | 100 | 150 | 250 | Yes | Final_Part_2.pdf §4 indicative range (unconfirmed) | 2026-09-13 | Yes — value is the PDF §4/§12 mid-point itself (150) |
| fugitive | 0 | 20 | 30 | Yes | IEA Global Methane Tracker 2025 | 2025-01-01 | Yes (D9: confirmed 2026-09-13, in range) |

Result: all 5 rows have low ≤ mid ≤ high, a named source and a date. Combustion, fleet and process mids
(120/200/150) are the PDF §4/§12 indicative mid-points themselves, so they trivially fall inside the PDF's
own range; scope2 and fugitive mids (20/20) were independently sourced and already confirmed in-range per D9.

Action: no data or code change made from this check. The CSCO category split (⚠ above) is a pre-existing
D14 mechanism limitation, not a data-entry error — flagged for the team to consider whether IT-sector median
shares should exclude fabless sub-industries when splitting Wikirate-only Scope 1 totals.

### [decision] Scope 1 corrections for verified unit errors in the shared Wikirate data

**Rule:** `17_build_inputs.py` applies `data/pipeline/nz/maps/scope1_corrections.csv` to the universe's
`scope1_tco2e` right after `sp500_esg_financials_raw.csv` is read (`nzlib.corrections.apply_scope1_corrections`),
by ticker. Every corrected ticker's flags gain `scope1-corrected`. A correction is made only when a citable,
company-disclosed figure for the same year (or the nearest year available) was found; otherwise the value is
left alone and the ticker is listed as unverified below.

**Why:** `sp500_esg_financials_raw.csv`'s Wikirate/GRI-sourced `scope1_tco2e` for a handful of tickers is
implausible by 3+ orders of magnitude against the company's actual business (checked against
`revenue_ttm`-normalised intensity vs. sub-industry peers and each company's own disclosures) — either a
unit slip (kg vs. t), a wrong-scope pull (e.g. a Scope 1+2+3 total mistaken for Scope 1), or a near-zero
placeholder. Left uncorrected, these distort within-sector Scope 1 scores in `company_inputs.csv`.

**Screen:** all 80 non-EPA-GHGRP (`scope1_source` = `Wikirate/GRI`) tickers in `sp500_esg_financials_raw.csv`
were ranked by `scope1_tco2e` / (`revenue_q`×4 ÷ 1e6) and checked against sub-industry peers and general
knowledge of each business's fuel/process intensity. 12 candidates were investigated (2026-09-13, checked by:
Claude Code session, WebSearch/WebFetch):

| Ticker | Year | Pipeline value | Corrected value | Source |
|---|---|---|---|---|
| CSCO | 2021 | 23,000,000 t | 34,931 t | tracenable.com, Cisco FY2022 disclosed Scope 1 (nearest year; see note below) |
| HPE | 2020 | 4,587,653 t | 39,800 t | DitchCarbon, HPE's own FY2020 disclosure (39.80M kg CO2e) |
| UPS | 2014 | 12,000 t | 14,499,000 t | tracenable.com, UPS FY2023 disclosed Scope 1 (nearest verifiable year; see note below) |
| ITW | 2022 | 9.40 t | 111,371 t | ITW 2023 CDP Climate Change response, C6.1 (reporting year 2022, exact match) |
| NEM | 2019 | 3.11 t | 1,591,000 t | Newmont 2021 Climate Report p.40, GRI 305-1 table (2019 column, exact match) |

Full sourcing detail and quotes are in `maps/scope1_corrections.csv`'s `note` column.

Notes on the two nearest-year (not exact-year) corrections:
- **CSCO supersedes the "Wikirate total (~23 Mt) is trustworthy" assumption** in the Top-20 hand check above.
  That check only questioned the combustion/process/fugitive *split*; this pass verified the *total* itself
  against Cisco's own FY2021 TCFD disclosure (total company-wide, all-scope footprint ~75.44 Mt CO2e, of which
  Scope 3 is 99.75%) and against Cisco's disclosed Scope 1 for FY2022–24 (33,683–39,514 t). 23,000,000 t is not
  a plausible Scope 1 figure for Cisco in any year; it reads as a wrong-scope or wrong-company pull. Cisco's
  exact FY2021 Scope 1 could not be extracted (ESG Hub charts are JS-rendered; the FY21 Purpose Report PDF
  exceeded automated fetch limits), so the correction uses the nearest disclosed year (FY2022).
- **UPS**: the original 12,000 t is off by roughly three orders of magnitude — UPS's own 2009 report disclosed
  7.5 Mt Scope 1 (fleet-dominated), and FY2022–24 disclosures show 14.4–15.8 Mt, both confirming a "double-digit
  million tonnes, mostly fleet fuel" scale for a company this size. The exact FY2014 figure (UPS's 2014
  Corporate Sustainability Report, Appendix B, p.108) could not be extracted by automated tools (oversized
  PDF); the correction uses the nearest well-sourced disclosed figure (FY2023) as a same-order-of-magnitude
  stand-in pending manual verification of the exact FY2014 number.

**Screened but not corrected** (checked against sub-industry peers/company disclosures and found plausible, or
no citable figure found — left as-is, `scope1_source` unchanged):
- **KO** (Coca-Cola, 4,400,000 t, 2022) — **verified correct**: matches Coca-Cola's own reported 2022 Scope 1
  of 4.4 Mt CO2e exactly (manufacturing + large HFC-refrigerant footprint from coolers/vending is a known
  Coca-Cola characteristic).
- **NSC** (Norfolk Southern, 5,358,750 t, 2014) and **CSX** (5,212,604 t, 2014) — plausible for Class I rail
  (diesel-heavy); CSX's own recent disclosures (~4.24 Mt) show a declining trend consistent with a higher 2014
  figure. No exact 2014 citation found; left unverified.
- **FDX** (FedEx, 15,406,173 t, 2019) — plausible: ~80% of FedEx's Scope 1 is aircraft jet fuel, and UPS (a
  comparable air-freight peer) discloses 14–16 Mt in nearby years. No exact 2019 citation found; left unverified.
- **CCL** (Carnival, 10,319,475 t, 2014) and **RCL** (Royal Caribbean, 4,404,403 t, 2014) — plausible for
  bunker-fuel-burning cruise lines of this size. No exact 2014 citation found; left unverified.
- **MOS** (Mosaic, 3,230,000 t, 2021) — plausible: Mosaic's own 2021 CDP response cites ~1.8 Mt for US
  facilities alone; a higher global total (with Saskatchewan potash operations included) is consistent. Global
  total not independently confirmed; left unverified.

**Action:** `maps/scope1_corrections.csv` and `nzlib/corrections.py` added (with pytest tests written first);
`17_build_inputs.py` hooked to apply corrections right after the universe CSV read; `company_inputs.csv` and
`emissions_sources.csv` regenerated via `17_build_inputs.py` and re-checked with `check_inputs.py`.
