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

## P4 model note (13 Sep 2026)

- [decision] Segment notes and classification run on gemini-3.5-flash-lite: free-tier daily quota of 20 requests for gemini-3.5-flash was exhausted; user chose flash-lite; lower accuracy risk mitigated by the ~10% hand-check.

## Hand checks

Record each check as: date, what was checked, sample, result, action.

- 13 Sep 2026 — DE/BEN segment labels, random 10% sample (seed 7, n = 78): 2 wrong (2.6%), corrected by hand and flagged `hand-corrected`. Both were RCL (Royal Caribbean) cruise segments labelled `exposed` with no PDF §5 basis (cruise/maritime is not on the exposed list); checking the rest of RCL and the other cruise line found the same error on all 5 RCL segments and 1 of 2 NCLH segments (CCL was already correctly `neutral`), so all 6 were corrected, not only the 2 sampled rows.
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

## P4 data rules (13 Sep 2026)

| Rule | Value |
|---|---|
| DE/BEN scope | Energy, Utilities, Materials, Industrials, Consumer Discretionary, Consumer Staples measured; other sectors DE = BEN = 0, status `unclassified` (PDF §15). |
| DE/BEN imputation | In-scope company without usable segments or note → sector median of measured DE and BEN, BEN capped at 1 − DE, flag `de-ben-imputed` (PDF §5). |
| Generation mix missing | Utility segment labelled `electricity_generation` without a disclosed mix → median utility mix, flag `generation-mix-imputed`. |
| Segment choice | ProductOrService preferred when it reconciles to TTM revenue within 10%; else BusinessSegments; a non-reconciling set must cover ≥ 50% of revenue, otherwise the segment note is read. |
