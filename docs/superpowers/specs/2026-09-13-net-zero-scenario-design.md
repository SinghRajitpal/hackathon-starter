# Net-Zero Scenario Tool (Part 2) — Design

Date: 2026-09-13
Branch: `part-2` (this file must never reach `main`)
Reference: `Final_Part_2.pdf` ("Net-Zero Scenario Tool, Part 2 blueprint", v1.0, 12 Sep 2026). The PDF is the single source of truth. Anything below that the PDF does not state is marked **[gap]** or **[decision]** and must be recorded in `docs/decisions-log.md` when implemented.

## 1. Goal and scope

Answer the ETHack Challenge #1 bonus question: "Tomorrow the world commits to net zero as fast as possible. You manage a $1B fund. How do you allocate, and why?"

Build every section of the Part 2 PDF (§4–§11) as working software on the existing Next.js + Supabase app, and surface the results on two pages:

- **Ticker risk panel**: clicking a ticker in the existing home-page search shows that company's net-zero scenario analytics.
- **`/portfolio`**: the §10 allocation feature (capital, mandate, thresholds, cost scenario), both books, sensitivity results, CSV export, and a method/limitations tab (§13, §14).

In scope now: engine, data pipeline, the two pages above, `docs/decisions-log.md`.

Out of scope now (combine phase, later): merging with Part 1 (teammates' repo), final layout and navigation, intuitive PM onboarding wording, visual polish, optional LLM narrative, the PowerPoint deck.

Only Part 2 is followed. Part 1 content is used only where the Part 2 PDF explicitly cites a Part 1 section (§4 → Part 1 §6 winsorising; §7 → Part 1 §7.1 guardrails; §11 → Part 1 §10 weight perturbation; §5 → Part 1 imputation-and-flag).

## 2. Decisions taken during brainstorming

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Normalisation | Min-max within GICS sector (PDF §7) | The PDF §12 numbers reproduce exactly under min-max (weights 0.29/0.42/0.29; scores within 0.2). Part 1's fixed reference ranges are not followed. |
| D2 | Git layout | Spec and plan live in `docs/superpowers/` on `part-2` only. Each phase is a branch `nz/pN-<name>` cut from `part-2` and merged back into `part-2`. `part-2` is never merged to `main` by us; the team merges Part 1 and Part 2 at the end, excluding `docs/superpowers/`. | User requirement. |
| D3 | Engine location | Python pipeline builds inputs into Supabase; the engine is pure TypeScript and runs in the browser | §8 and §10 need live overrides. |
| D4 | Emissions raw data | Stored in Supabase too (long-format source table) | User requirement; every number traceable. |
| D5 | DE/BEN extraction | 3 tiers: SEC Financial Statement Data Sets (free) → Gemini classifies segment names → Gemini reads only the segment note for untagged companies → sector median + flag if not disclosed | Cheapest path that stays faithful to §5. |
| D6 | LLM | Gemini 2.5 Flash, free tier ($0). JSON-schema output, temperature 0, cached responses | Cheapest. Estimate ~0.45M tokens typical, ~1M worst case, ~80–130 requests. |
| D7 | Utilities DE/BEN | Generation segment revenue × fuel share of owned generation (MWh) from the 10-K: fossil share → DE, renewable share → BEN | Segment revenue alone cannot separate fossil from renewable generation. |
| D8 | Earnings basis | Trailing twelve months = sum of the last 4 reported quarters (yfinance) for EBITDA, FCF, revenue; latest net debt | §4 needs annual EBITDA; current dataset uses a single quarter (ND/EBITDA inflated 4×). |
| D9 | MAC values | Research subagent confirms IEA/McKinsey figures per category, starting from §12 mid-points (30/120/200/150/15 USD/t). Any figure outside the PDF range is flagged for team approval before use. | §4 requires confirmation before the first full run. |
| D10 | Emissions sources | GHGRP subparts (US combustion/process/fugitive) + Climate TRACE v7 for non-US assets + Wikirate Scope 2 | §4 names GHGRP and Climate TRACE. |
| D11 | Missing emissions | Missing Scope 2 → sector-median Scope 2 intensity × company TTM revenue. No emissions in any source → sector-median TBR. All flagged. | Mirrors the §5 imputation rule; UI states counts (§15). |
| D12 | Fleets | Gemini reads 10-K fuel disclosures (gallons) for fleet-heavy sub-industries; converted with EPA GHG Emission Factors Hub 2025 | Climate TRACE has no owner-level fleet assets (Delta's only asset is its refinery). |
| D13 | Climate TRACE attribution | Count an asset only if the company appears in that asset's own owner list; non-US only; emissions split equally across distinct owners; flagged "CT equal-split" | API exposes no ownership share; owner queries return assets whose own owner list omits the company. |
| D14 | Wikirate-only Scope 1 totals | Subtract fleet (from D12) first, floor at 0; split the remainder by median category shares of GHGRP-split peers in the same sector. No Climate TRACE added. Flagged "category split imputed". | Wikirate totals are global; adding Climate TRACE would double count. |
| D15 | Long-only tilt amount | Bottom decile → 0. Other bottom-quintile names are cut by (own distance from median ÷ largest distance in that quintile). Freed weight goes to the top quintile in proportion to distance. Then clamp ±2pp active and 5% per name; excess returned pro-rata within the sector. | §9.2 does not state the amount moved. |
| D16 | Benchmark weights | Float-adjusted cap = market cap × (float shares ÷ shares outstanding); fall back to market cap when the ratio is below 0.5; flagged | yfinance `floatShares` is wrong for dual-class shares (BRK-B). |
| D17 | Explanation text | Deterministic templates from the decomposition (§7/§12 sentence shape). No LLM. | Numbers always match the live engine; $0. |
| D18 | `/portfolio` access | Public: add to the allowlist in `lib/supabase/proxy.ts` | Data is public; judges must open it without an account. |

## 3. Evidence gathered (13 Sep 2026)

- Existing dataset (`data/out/sp500_esg_financials_raw.csv`, 503 rows): EBITDA 456, FCF 501, ND/EBITDA 453; Scope 1 183 (EPA GHGRP match 103), Scope 2 122; 9 non-positive EBITDA.
- Tradeable-candidate sectors (Energy, Utilities, Materials, Industrials, Consumer Discretionary, Consumer Staples) = 241 companies. GHGRP category split available for 85; Wikirate-only Scope 1 total for 42; Scope 2 for 81; no emissions at all for 116.
- GHGRP 2023 "Direct Point Emitters" subpart columns sum exactly to the facility total; matched totals equal the dataset's Scope 1 (ratio 1.00). Files also contain 2019 (for §11 validation); parent-company file has sheets 2010–2023.
- SEC Financial Statement Data Sets (2025q2–2026q2): latest 10-K found for 238/241; usable single-axis `BusinessSegments`/`ProductOrService` revenue for 178; 819 (company, segment) pairs; 60 untagged (Industrials 17, Utilities 12, Materials 11, Staples 11, Discretionary 7, Energy 2). Utilities use `RegulatedAndUnregulatedOperatingRevenue` and `LegalEntity` axes.
- Climate TRACE v7: `/v7/owners?name=`, `/v7/sources?ownerIds=` (per asset: country, subsector, emissions), `/v7/sources/:id` (owner list, no share). 69 subsectors.
- SEC companyfacts has FY2019 revenue, operating income, and D&A.
- yfinance: quarterly EBITDA for the last 4 quarters, price, market cap, float shares.
- Fleet-heavy candidates by sub-industry: 35 (airlines, air freight, cargo ground, rail, cruise/hotels, environmental services, distributors, automotive retail, passenger ground, leisure).

## 4. Architecture

```
data/pipeline/nz/*.py  ──►  data/out/nz/*.csv  ──►  Supabase nz_* tables
                                                        │
app/page.tsx (server loader) ─┐                          │
app/portfolio/page.tsx (server loader) ─┴── lib/netzero/load.ts ◄──┘
                                   │ plain props
                                   ▼
               client components run lib/netzero/* (pure TS)
               ├─ components/netzero/ticker-risk-panel.tsx
               └─ components/netzero/portfolio/*
```

Secrets (`GEMINI_API_KEY`, `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE` session-pooler credentials) live in `.env.local` only and are never committed. Creating tables writes to the shared Supabase project and is confirmed with the user before running.

## 5. Data pipeline — `data/pipeline/nz/`

Follows existing conventions: numbered scripts run from their directory, raw downloads in gitignored `data/raw/`, one row per ticker enforced with asserts, per-ticker errors captured in a `fetch_error` column, psycopg2 upsert loader converting NaN to NULL per value. Managed with `uv`.

| Script | Does | Output (`data/out/nz/`) |
|---|---|---|
| `10_ttm_financials.py` | yfinance: sum of last 4 quarters of revenue, EBITDA, FCF; latest net debt (with the `02_` fallback to total debt − cash); price, market cap, shares outstanding, float shares, float-cap with D16 fallback | `financials_ttm.csv` |
| `11_ghgrp_categories.py` | GHGRP 2023 and 2019: Direct Point Emitters subparts plus the Onshore O&G, Gathering & Boosting, Transmission Pipelines, LDC and SF6 sheets, mapped to categories (below); parent match with ≥50% ownership and the `08_` name normaliser | `ghgrp_categories.csv` (ticker, year, combustion, process, fugitive) |
| `12_climate_trace.py` | Climate TRACE v7 via hand-checked `maps/ct_owner_map.csv`; non-US assets with verified owner; equal split; subsector → category | `ct_categories.csv` |
| `13_fleet_fuel.py` | Gemini extracts fuel consumed by type from 10-K for fleet candidates; EPA factors → tCO2e | `fleet.csv` |
| `14_sec_segments.py` | SEC Financial Statement Data Sets, 4 quarters; revenue tags incl. `Revenues`, `RevenueFromContractWithCustomer*`, `RegulatedAndUnregulatedOperatingRevenue`; single-axis segment/product rows, excluding totals, eliminations, aggregations | `segments_raw.csv` |
| `15_classify_segments.py` | Gemini labels each (company, segment) exposed / beneficiary / neutral against the two product mapping tables, batches of 50 | `segment_classes.csv` |
| `16_segment_notes.py` | For untagged companies and all utilities: download the 10-K, locate the segment note / generation-mix section in Python, send only that text to Gemini | `segment_notes.csv` |
| `17_build_inputs.py` | Merge; Scope 2 imputation (D11); Wikirate category split (D14); DE and BEN with status; ratios; flags | `company_inputs.csv`, `emissions_sources.csv` |
| `18_validation_2019.py` | SEC companyfacts FY2019 (EBITDA = operating income + D&A) + GHGRP 2019 → TBR 2019 and change in emissions intensity 2019 → latest | `validation_2019.csv` |
| `19_load_supabase.py` | Upserts all `nz_*` tables | — |
| `check_inputs.py` | Fails loudly on invariant breaks; prints coverage per sector | — |

GHGRP category mapping:
- **Combustion**: Stationary Combustion, Electricity Generation.
- **Fugitive**: all Petroleum and Natural Gas Systems subparts, Underground Coal Mines, Municipal Landfills, Industrial Wastewater Treatment, Industrial Waste Landfills, and the whole Onshore O&G / Gathering & Boosting / Transmission Pipelines / LDC / SF6 sheets (§4 table names subpart W for fugitive).
- **Process**: every other industrial subpart (cement, iron and steel, refining, petrochemicals, ammonia, hydrogen, lime, glass, aluminium, etc.).
- **Fleet**: not in GHGRP (D12). **Scope 2 (purchased electricity)**: Wikirate (D10/D11).

Climate TRACE subsector mapping: electricity-generation, heat-plants, *-onsite-fuel-usage, other-energy-use → combustion; domestic/international aviation and shipping, railways, road-transportation, other-transport → fleet; cement, iron-and-steel, aluminum, chemicals, other-chemicals, petrochemical-steam-cracking, oil-and-gas-refining, lime, glass, pulp-and-paper, other-manufacturing, other-metals, food-beverage-tobacco, textiles, wood → process; oil-and-gas-production, oil-and-gas-transport, coal-mining, other-fossil-fuel-operations, solid-waste-disposal, wastewater, fluorinated-gases, mining/quarrying → fugitive. Agriculture, forestry and land-use subsectors are excluded (not company Scope 1 sources in §4).

Hand-maintained CSVs in `data/pipeline/nz/maps/` (each with source columns, all shown in the UI):
- `mac_costs.csv`: category, low, mid, high, source URL, source date (D9).
- `exposed_products.csv`, `beneficiary_products.csv`: the §5 product-line lists.
- `ct_owner_map.csv`: ticker, Climate TRACE owner IDs, checked-by, note.
- `emission_factors.csv`: fuel, kg CO2e per unit, EPA hub reference.

### Supabase tables (public read, RLS enabled, appended to `supabase/schema.sql`)

- `nz_company_inputs` (PK ticker): company_name, sector, sub_industry; `e_scope2`, `e_combustion`, `e_fleet`, `e_process`, `e_fugitive` (tCO2e, nullable); emissions_year; `revenue_ttm`, `ebitda_ttm`, `fcf_ttm`, `net_debt`; `de`, `ben`, `de_ben_status` (tagged | note | imputed | unclassified); `price`, `shares_outstanding`, `float_cap`; `flags text[]`; `updated_at`.
- `nz_emissions_sources`: ticker, source (GHGRP | ClimateTRACE | 10-K fleet | Wikirate | imputed), category, tco2e, year, reference.
- `nz_segments`: ticker, segment, revenue, class, share, fiscal_year, filing_url, method.
- `nz_mac_costs`, `nz_product_map`, `nz_validation_2019`.

The bill, TBR, and the no-emissions sector-median TBR imputation are computed in the engine, because they depend on the live MAC scenario.

## 6. Engine — `lib/netzero/` (pure TypeScript, no I/O)

| Module | Behaviour |
|---|---|
| `types.ts` | `CompanyInput`, `ScenarioConfig` (MAC vector, TBR IQR threshold 0.25, score IQR threshold 25, capital default 1e9, mandate default long-only), result types. |
| `bill.ts` | Bill = Σ category emissions × max(MAC, 0) (§4). TBR = bill ÷ TTM EBITDA. **[gap]** Near-zero EBITDA = EBITDA ≤ 0 or EBITDA ÷ revenue < 1%; TBR set to the sector winsorisation ceiling and flagged. No emissions → sector-median TBR, flagged (D11). |
| `transform.ts` | Winsorise TBR at the sector 97.5th percentile; `log1p(TBR)` (§4). Directions: TBR cost, DE cost, BEN benefit, ND/EBITDA target (target = sector median; distance treated as cost), FCF margin benefit (§3, §6). Min-max within sector (D1). **[gap]** Constant column → all 1 (its entropy weight becomes 0). |
| `entropy.ts` | Entropy weight method; 0.40 cap with proportional redistribution; cap events logged (§7 → Part 1 §7.1). **[gap]** If fewer than 3 variables have non-zero weight in a sector the cap cannot hold; the cap is relaxed to 1 ÷ (number of non-zero variables) and the event is logged. |
| `topsis.ts` | D+, D−, score = 100·D− ÷ (D+ + D−); per-variable decomposition shares; ties broken by smaller D+ (§7). |
| `scenario.ts` | Runs transform → entropy → TOPSIS per GICS sector; returns score, sector rank, sector percentile, decomposition, weights per sector. |
| `dispersion.ts` | Per sector: IQR of raw TBR and of score. Tradeable if TBR IQR > threshold or score IQR > threshold. Ordered by score IQR (§8). **[gap]** Quantiles by linear interpolation. |
| `longShort.ts` | Names per side = ceil(N ÷ 5), min 2, max 5 (§9.1). **[gap]** Rounding up. Size ∝ \|score − sector median\|; zero distance → untraded. Long and short legs dollar-equal. Sector gross ∝ score IQR. Limits: name ≤ 3% of gross, sector ≤ 20% of gross, gross 200% of capital, net 0. **[gap]** Name-cap excess redistributed within its leg; sector-cap excess redistributed across other tradeable sectors ∝ IQR; if infeasible, residual stays in cash and reported gross falls below 200%. |
| `longOnly.ts` | Benchmark = float-cap weights (D16). Tilt per D15 within tradeable sectors; flat sectors held at benchmark; sector weights equal benchmark (§9.2). **[gap]** Quintile = ceil(N ÷ 5), decile = ceil(N ÷ 10). |
| `exclusion.ts` | Naive comparison: remove the index's top decile by absolute Scope 1+2, re-weight remaining names by float cap; report sector weights next to benchmark and tilt (§9.2). |
| `sensitivity.ts` | MAC runs: base, all ×0.5, all ×1.5, each of 5 categories ×2 (8 runs). Weight perturbation: 1,000 Dirichlet draws per sector, seeded RNG. **[gap]** α = 100 × entropy weight. **[gap]** Survival: "all" = same direction in every MAC run; "most" = at least half; "few" = fewer than half. Positions that flip sign under ±50% are halved, then the leg is re-normalised to keep neutrality (§11). **[gap]** Headline = share of picks surviving all MAC runs and ≥90% of weight draws. |
| `allocation.ts` | Dollars = weight × capital; shares = floor(dollars ÷ latest price); top 2 drivers; direction; CSV rows (§10). |
| `explain.ts` | Template sentences from decomposition (D17). |
| `load.ts` | Server-side Supabase loader used by both pages (the only module with I/O; lives beside the engine but is not imported by it). |

Performance: core recompute under 50 ms; the 1,000-draw stress test runs on a button, not on every input change.

## 7. UI

- Server components load `nz_company_inputs`, `nz_mac_costs`, `nz_product_map`, `nz_segments` once via `lib/supabase/server.ts` and pass plain props to client components that run the engine.
- New shadcn primitives (new-york style): tabs, table, slider, select, tooltip. Bars are Tailwind divs; no chart library.

**Ticker risk panel** (`components/netzero/ticker-risk-panel.tsx`, rendered in the existing `CardContent` of `components/ticker-search.tsx`; the home page becomes server loader + client search; `/?ticker=XOM` preselects):
header with score, sector rank and percentile; book positions (long/short and long-only active weight); reason sentence; transition burden (TBR vs sector median, bill, bill by category bars); revenue mix (DE, BEN, segments); headroom (ND/EBITDA vs target, FCF margin); driver decomposition bars; sector context (tradeable/flat, IQRs); stress-test survival; data sources and flags; link to `/portfolio`.

**`/portfolio`** (`app/portfolio/page.tsx`): controls (capital, mandate, cost scenario, both thresholds, run stress test, download CSV) and tabs:
- **Sectors**: dispersion table, tradeable/flat, ordered by score IQR.
- **Long-only**: summary; sector weights benchmark vs tilt vs exclusion; top over/underweights with reasons; full weight table.
- **Long/short**: gross, net, names; per-sector legs; largest positions each side with dollars and shares; reasons.
- **Stress test**: headline survival share; per-position all/most/few; flipped column; 2019 validation card.
- **Method**: MAC table with sources and dates; product mapping tables; weights per sector with cap events; coverage counts; §13 Q&A; §14 limitations.

States: loading skeletons; Supabase error card plus console log; ticker not in scenario universe → message with reason; DE/BEN not yet loaded → banner "DE/BEN not yet classified: running with 0" (§15).

## 8. Error handling

- Pipeline: one bad ticker never stops a run (`fetch_error`); Gemini calls use JSON schema, temperature 0, retry with backoff on 429, and a response cache in `data/raw/nz/gemini_cache/` so reruns cost 0 tokens; SEC requests send a descriptive User-Agent and are throttled.
- Engine: never throws on missing values; every imputation or fallback adds a flag that the UI shows.
- UI: errors are shown, never swallowed.

## 9. Testing and verification

- **Engine (vitest)**: §12 oracle written first — with log, winsorising and cap disabled as the PDF states — expecting weights 0.29/0.42/0.29, scores within ±0.3 of U4 80.8, U2 72.4, U3 44.0, U1 20.2, U5 0.0, long split 56.5/43.5, short split 64.9/35.1, dollars 28.2/21.8/32.4/17.6 M on 100 M gross. Invariants: weights sum to 1 and ≤ 0.40 (or the logged relaxed cap); long/short net 0, gross ≤ 200%, name ≤ 3%, sector ≤ 20%; long-only sector weights = benchmark, active ±2pp, name ≤ 5%; bill ≥ 0; seeded perturbation reproducible.
- **Pipeline (pytest, small fixtures)**: category mappings, TTM sums, Climate TRACE equal split and US exclusion, float-cap fallback, imputations, segment filter. Gemini mocked only in unit tests; real calls validated on 3 hand-checked companies before the batch.
- **Real data**: `check_inputs.py` — one row per ticker; categories sum to GHGRP total within 0.1%; no negative emissions; DE + BEN ≤ 1; coverage counts per sector match the UI.
- **Hand checks** recorded in `docs/decisions-log.md`: top 20 emitters' category splits, Climate TRACE owner map, ~10% of DE/BEN classifications, MAC sources.
- **UI**: `npm run lint`, `npm run build`, run the app, click through XOM, NEE and one flat-sector ticker; `/portfolio` both mandates, stress test, CSV download; screenshots as evidence.
- Bugs: failing test committed before the fix.

## 10. Phases

Each phase: branch `nz/pN-<name>` from `part-2`; done when tests/lint/build pass in-session with output shown, the result is visible on a page, decisions-log entries are written, and `/code-review` has run; then merge into `part-2`. Ask before any push.

| Phase | Content | PDF |
|---|---|---|
| P0 | Setup: vitest, uv project for `nz/`, schema.sql entries, `docs/decisions-log.md`, proxy allowlist, loader + empty panel shell | — |
| P1 | Inputs: TTM financials and float caps; GHGRP categories; Climate TRACE; Scope 2; fleet fuel; MAC research | §4, §6 |
| P2 | Transition bill and TBR, largest emitters first | §4 |
| P3 | Scenario score and decomposition (§12 oracle) | §7 |
| P4 | DE/BEN pipeline (parallel data track with P2–P3) | §5 |
| P5 | Dispersion and tradeable sectors | §8 |
| P6 | Long/short book | §9.1 |
| P7 | Long-only tilt and exclusion comparison | §9.2 |
| P8 | Sensitivity re-runs, weight perturbation, 2019 validation (2-hour time box) | §11 |
| P9 | Ticker risk panel complete, `/portfolio`, CSV export, method tab | §10, §13, §14 |

Parallelism: data track (P1, P4) runs alongside the engine track (P2, P3, P5–P8 on fixtures). Subagent batches need user approval first.

Time guard (under 8 hours): if P4 is late, ship with DE/BEN = 0 and the §15 banner; if the §11 validation exceeds its time box, report it as a limitation.

Commits: Conventional Commits, author Rajitpal Singh <singh.rajitpal@gmail.com>, no AI co-author line.
