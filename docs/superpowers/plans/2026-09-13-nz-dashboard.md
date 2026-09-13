# Net-Zero Risk Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Tasks A–D run in parallel worktrees; each owns disjoint files.

**Goal:** Replace the Part 2 ticker panel and five-tab portfolio page with a terminal-style dashboard (MARKET · SECTOR · COMPANY · PORTFOLIO) answering the fund manager's questions, with risk presets.

**Architecture:** The existing engine (`lib/netzero/*`) is unchanged except for a configurable long-only active limit and a robust-only filter. Pure view-model builders in `lib/netzero/dashboard/*` turn `ScenarioData` + `DashboardModel` into tiles, rows and takeaway sentences (unit-tested with `syntheticUniverse()` from `lib/netzero/fixtures.ts`). Client screen components in `components/dashboard/*` render them with the shared frame (`KpiTiles`, `Takeaways`, `Panel`, `Pill`, `ScreenHeader`).

**Tech Stack:** Next.js 16.3 (`cacheComponents`), React 19.3, Tailwind 3, vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-13-nz-dashboard-design.md`

## Global Constraints

- Time box: about 1 hour total; each task ≤ 30 minutes. Keep code small; no new dependencies.
- Scaffold already on `part-2`: `lib/netzero/dashboard/{types,presets,model,labels}.ts`, `components/dashboard/{frame,dashboard-app,method-drawer}.tsx`, placeholder screens, `/` renders the dashboard, `/portfolio` redirects. Do not change `types.ts` contracts, `frame.tsx`, or `dashboard-app.tsx` (controller owns them); ask in your report if a contract must change.
- Plain-language names on screen: "Net-zero readiness" (scenario score), "Cleanup cost" (TBR, years of earnings; also show months where helpful), "Revenue at risk" (DE), "Revenue upside" (BEN), "Debt load" (ND/EBITDA), "Cash flow margin" (FCF margin). No entropy/IQR/flag jargon on screens.
- At most 3 takeaway sentences per screen, generated from data (templates, no LLM).
- Formatting helpers: `formatUsd`, `formatPercent`, `formatYears`, `formatRatio` in `lib/netzero/format.ts`.
- Tests first for every view-model builder; assert observable output. Run `npm test` and `npm run lint` (no dev server, no build in task worktrees; the controller builds after merge).
- Commits: Conventional Commits, author preconfigured, no Co-Authored-By or other trailer, no push, no subagents.

## Task A: MARKET and SECTOR screens

**Files:** create `lib/netzero/dashboard/market.ts`, `market.test.ts`, `sector.ts`, `sector.test.ts`; replace `components/dashboard/market-screen.tsx`, `sector-screen.tsx`.

**Produces:**
- `sectorVerdict(row: { tradeable: boolean; fossilShare: number; cleanupYears: number }): SectorVerdict` — tradeable → "pick-winners"; else fossilShare ≥ 0.5 or cleanupYears ≥ 0.1 → "sector-hit"; else "barely-affected".
- `buildMarketView(data, model): { tiles: Tile[]; rows: MarketRow[]; takeaways: string[] }` where `MarketRow = { sector; n; cleanupYears (Σ bill ÷ Σ positive EBITDA); billUsd; fossilShare, greenShare (revenue-weighted DE/BEN, null→0); gapYears (dispersion.tbrIqr); verdict }`, sorted pick-winners (by gapYears desc), then sector-hit (by cleanupYears desc), then barely-affected. Tiles: index cleanup bill ($ and years), fossil revenue %, green revenue %, "Sectors to pick winners" count. Takeaways e.g. widest gap sector; most fossil-exposed sector; "N of 11 sectors barely affected".
- `buildSectorView(data, model, sector): { tiles; rows: SectorCompanyRow[]; takeaways } | null` with rows ranked by score: `ticker, name, score, cleanupYears (score.tbr), revenueAtRisk (de), revenueUpside (ben), debtLoad (ndEbitda), label (companyLabel), activePp (long-only active × 100)`. Takeaway compares median cleanup cost of leaders vs laggards in months of earnings.
- Screens: MARKET table rows click → `nav.openSector`; SECTOR rows click → `nav.openCompany`; SECTOR with `sector === null` shows a sector picker list.

## Task B: COMPANY screen

**Files:** create `lib/netzero/dashboard/company.ts`, `company.test.ts`; replace `components/dashboard/company-screen.tsx`.

**Produces:** `buildCompanyView(data, model, ticker): CompanyView | null` with `header { ticker, name, sector, subIndustry, label, verdictText ("Laggard · bottom 20% of Utilities"), score, rank, sectorSize }`; `tiles` (4, each value + sub "Sector median …" + tone: cleanup cost (years and $ bill), revenue at risk, revenue upside, can it pay (debt load vs sector median; cash flow margin)); `billSplit` (five categories, $ = emissions × `model.config.mac`); `peers` (sector companies sorted by score: ticker, score, isSelf); `reason` (`reasonSentence` from `lib/netzero/explain.ts` with overweight/underweight/benchmark from long-only active and sector median TBR from dispersion); `stance` ("Overweight +0.8pp" / "Underweight −1.2pp" / "Held at benchmark"); `badges { robust: "holds" | "does-not-hold" | "no-position" (from model.stress picks; "no-position" when stress null or not a pick), data: "reported" | "estimated" (estimated when any flag contains "imputed" or "fallback") }`; `takeaways` ≤ 3. Screen: null ticker → prompt to type a ticker; unknown ticker → "not in the S&P 500 scenario universe"; peer strip clickable → `nav.openCompany`; link to sector.

## Task C: Engine for presets (lib only)

**Files:** modify `lib/netzero/longOnly.ts` (thread `limits` through `buildLongOnly(scores, companies, dispersion, limits = LO_LIMITS)` into `tiltSector`), `lib/netzero/sensitivity.ts` (accept optional long-only limits for its rebuilds), `lib/netzero/dashboard/model.ts`; create `lib/netzero/dashboard/model.test.ts`, `lib/netzero/dashboard/robust.ts` + test; append decisions-log entries.

**Produces (same `buildDashboardModel(data, answers, adjust)` signature):** long-only book built with `{ activeLimit: preset.activeLimit, nameMax: LO_LIMITS.nameMax }`; `stress = runSensitivity(...)` for the preset's book (use 300 draws, seed 42, keep it under ~200 ms on 503 companies; log the draw count); when `preset.robustOnly`, `neutraliseLongOnly(book, nonRobust: Set<string>): LongOnlyBook` sets those names' active weight to 0 and rescales the remaining actives in each sector so every sector's portfolio weight still equals its benchmark weight and no active exceeds the limit (excess returned to benchmark). Tests: ±1pp preset never exceeds 0.01 active; robust-only book has zero active on non-robust names and sector weights equal benchmark; Aggressive trades at least as many sectors as Balanced on the synthetic universe. Decisions log: presets table, robust-only rule, stress draw count on the dashboard.

## Task D: PORTFOLIO screen and onboarding

**Files:** create `lib/netzero/dashboard/portfolio.ts`, `portfolio.test.ts`, `components/dashboard/onboarding.tsx`; replace `components/dashboard/portfolio-screen.tsx` (keep `PortfolioScreenProps`).

**Produces:** `portfolioMetrics(data, model, weights: Map<string, number>): { cleanupYears (Σ w·tbr), carbonCostPerMillion (Σ w · bill ÷ floatCap × 1e6), fossilShare (Σ w·de), greenShare (Σ w·ben) }`; `buildPortfolioDashboard(data, model): { tiles; comparison: { metric; portfolio; benchmark; exclusion }[]; sectorBets: { sector; activePp }[]; overweights; underweights (top 10 each: ticker, name, sector, activePp, dollars, reason); robustnessText; takeaways; csv (existing `allocateLongOnly` + `toCsv`, or long/short when `model.preset.longShort`); longShort: summary rows | null }`. Tiles: portfolio vs S&P 500 change in cleanup burden (%), fossil revenue (pp), green revenue (pp), active share, robust picks share (from `model.stress?.headline`). Onboarding: the three questions from the spec with current answers preselected, "Apply" calls `onAnswers`; "Adjust" section for capital (ignore empty input) and cost scenario low/mid/high calls `onAdjust`. CSV download button uses a Blob link.

## Controller integration (after A–D)

Merge task branches into `part-2`; delete unused `components/netzero/portfolio/*` tabs except `method-tab.tsx`, `components/netzero/ticker-risk-panel.tsx`, `components/netzero/sections/*`, `components/ticker-search.tsx` and their tests if nothing imports them; `npm test`, `npm run lint`, `npm run build`; browser check (market → sector → company drill-down, command box, onboarding presets change traded sectors, CSV, no console errors).
