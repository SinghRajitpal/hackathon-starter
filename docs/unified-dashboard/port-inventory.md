# Unified dashboard: port inventory (Phase 1)

Branch `feature/unified-dashboard`, cut from `origin/main` at `3b3601c`.
We port code from two reference worktrees and never merge their histories:

- `../ref-tool1` checks out `gemini-integration` at `da07446` (Tool 1, Sustainability Evaluator).
- `../ref-tool2` checks out `nz/explain-gemini` at `db7dded` (Tool 2, Net-Zero Scorer).

## Facts that change the plan

- Main has no `src/` directory, and the `@/*` alias points at the repo root. The feature folders are therefore `features/sustainability/` and `features/netzero/`.
- `tailwind.config.ts` does not scan `features/`. Add `./features/**/*.{ts,tsx}` there.
- All three landing "Get started" buttons link to `/app`: nav top-right, hero, and closing CTA. `app/app/page.tsx` holds the old TickerSearch page.
- Both tools read the same Supabase project, and every table they need exists and has data.
  - `sp500_esg_scores` has 503 rows, `sp500_esg_correlation` 49, and `sp500_esg_gemini_analysis` 2.
  - `nz_company_inputs` has 503 rows, `nz_segments` 785, and `nz_explanations` 23.
  - The web app only reads these tables, so neither Python pipeline needs porting.
- Tool 1 has no TypeScript scoring. Its scores are precomputed rows, and its pages query Supabase inline.
- Tool 2 computes scores in the browser from raw inputs using `lib/netzero` plus `buildDashboardModel`. Net-zero ranks are within a sector only.

## Tool 1: files to port into `features/sustainability/`

| Kind | Source (`../ref-tool1/`) | Note |
|---|---|---|
| logic | `lib/variables.ts` | `AXES`, `AxisKey` |
| logic | `lib/gemini/schema.ts`, `build-company-payload.ts`, `system-prompt.ts` | pure |
| route | `app/api/sustainability-analysis/route.ts` | cache writes must use the admin client |
| components | `components/leaderboard-table.tsx`, `weight-and-correlation.tsx`, `company-detail.tsx`, `gemini-analysis.tsx` | rewrite the `/leaderboard/...` links and the fetch URL |
| page reference | `app/leaderboard/page.tsx`, `app/leaderboard/[ticker]/page.tsx` | queries become `getSustainabilityRanking` and `getSustainabilityScore` |
| types | `ScoreRow`, `CompanyDetailRow`, `CorrelationRow`, `CompanyPayload`, `GeminiAnalysis` | move into `types.ts` so logic never imports components |
| tests | `lib/gemini/build-company-payload.test.ts`, `schema.test.ts`, `client.test.ts` | `client.test.ts` needs a rewrite for the consolidated client |
| reference only | `lib/gemini/client.ts` | conflicts with main's `lib/gemini/client.ts` |

## Tool 2: files to port into `features/netzero/`

| Kind | Source (`../ref-tool2/`) |
|---|---|
| engine | `lib/netzero/{types,bill,transform,entropy,topsis,scenario,engine,dispersion,exclusion,longOnly,longShort,waterfill,sensitivity,rng,allocation,portfolio,config,explain,format,stats}.ts` |
| view models | `lib/netzero/dashboard/{model,presets,robust,labels,company,sector,market,portfolio,types}.ts` |
| data | `lib/netzero/{load,rows}.ts` |
| explain layer | `lib/explain/{packets,verdict,fallback,grounding,prompt,schemas,gemini,service,limits,key-cache,request,types}.ts`, `lib/server/{explain,gemini-client,secrets,supabase-admin}.ts`, `app/api/explain/route.ts` |
| company view | `components/dashboard/{company-screen,explanation,frame}.tsx` |
| portfolio view (moved as-is) | `components/dashboard/{portfolio-screen,onboarding}.tsx`, plus a new client wrapper that replaces `dashboard-app.tsx` state and `Nav` |
| ranking | `components/dashboard/sector-screen.tsx` (reference) |
| tests | 35 `*.test.ts` files, `lib/netzero/fixtures.ts`, `lib/netzero/validation.ts`, `vitest.config.mts` |
| do not port | `docs/superpowers/`, `data/pipeline/nz/`, `data/out/nz/`, `components/dashboard/dashboard-app.tsx` shell, `app/page.tsx` |

The unified functions do not exist yet in either branch:

- `getNetZeroScenario(ticker)` loads data with `loadScenarioData`, builds the model with `buildDashboardModel(data, DEFAULT_ANSWERS)`, then calls `buildCompanyView` and `verdictForTicker`.
- `getNetZeroRanking()` iterates `model.result.scores` and adds the verdict and label. It must group rows by sector, because scores are not comparable across sectors.

## Shared-file conflicts (Phase 5 list)

| File | Resolution |
|---|---|
| `package.json` / lockfile | Add `zod`, `vitest`, `@google/genai` and a `test` script, then regenerate the lockfile with npm. Do not copy either branch's lockfile. |
| `lib/supabase/proxy.ts` | Let the new public routes through: `/dashboard`, `/ticker`, `/tickers`, `/portfolio`, `/market`, and the two API routes. |
| `supabase/schema.sql` | Append Tool 1's three tables and Tool 2's `nz_*` tables, `get_secret`, and `nz_explanations`. This is additive and needs no database writes. |
| `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx` | Neither branch changed these. Only add the `features/` content glob to `tailwind.config.ts`. |
| **Gemini client** | Three versions exist and conflict in real logic. Main reads the key from Vault via RPC `get_gemini_api_key` and calls REST. Tool 1 reads `GEMINI_API_KEY` from env, calls REST, and defaults to `gemini-2.5-flash`. Tool 2 reads Vault via RPC `get_secret` and uses the `@google/genai` SDK. **Needs a user decision.** |
| **Admin client and env** | Main reads `SUPABASE_SERVICE_ROLE_KEY`, but `.env.local` has only `SUPABASE_SECRET_KEY`, which Tool 2 reads. **Needs a user decision.** |

## Decisions

- **2026-09-13, Gemini key and client:** each tool keeps its own setup (user's choice).
  - Tool 1 reads `GEMINI_API_KEY` and `GEMINI_MODEL` from env, and its client lives in `features/sustainability/`.
  - Tool 2 reads the key from Vault using `SUPABASE_SECRET_KEY`, and its client lives in `features/netzero/`.
  - Main's `lib/gemini/client.ts` and `lib/supabase/admin.ts` stay as they are.

## Known defects to fix while porting

- Tool 1's `sp500_esg_gemini_analysis` has anon INSERT and UPDATE policies with `using (true)`, so anyone can overwrite cached analyses. Write with the admin client and drop those policies once the user approves a database change.
- Tool 1's correlation cells use `color-mix(var(--primary))`, but `--primary` holds an HSL triplet, so no colour renders. Use `hsl(var(--primary))`.
- Tool 2's `lib/netzero/explain.ts` clashes by name with `lib/explain/`. Rename it when it moves.
