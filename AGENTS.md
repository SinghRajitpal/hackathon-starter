<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Meridian repo — project map

- **Routes:**
  - The landing page `/` lives in `components/landing/`.
  - App pages live in `app/(app)/`:
    - `/dashboard`: ticker search.
    - `/ticker/[symbol]`: sustainability and net-zero panes that scroll on their own.
    - `/tickers`: A–Z index and rankings, chosen with `?ranking=sustainability|netzero|both`.
    - `/portfolio`: the net-zero portfolio screen.
    - `/market`: net-zero MARKET screen, with sectors grouped by verdict.
    - `/market/[sector]`: net-zero SECTOR screen, showing winners and losers inside one sector.
- **Tools:**
  - Tool 1 (Sustainability Evaluator) lives in `features/sustainability`, ported from branch `gemini-integration`.
  - Tool 2 (Net-Zero Scorer) lives in `features/netzero`, ported from branch `nz/explain-gemini`.
  - Pages call each feature's `index.ts` data functions and its components. The two tools share no code.
  - The port record is `docs/unified-dashboard/port-inventory.md`.
- **Theme:** every page uses the dark navy Meridian look. Colours are tokens in `app/globals.css`, and the root layout forces the `dark` class. Use tokens, not hardcoded colours.
- **Gemini:** each tool keeps its own setup.
  - Tool 1 reads `GEMINI_API_KEY` and `GEMINI_MODEL` from env.
  - Tool 2 reads the key from Vault using `SUPABASE_SECRET_KEY`.
- **Commands:** `npm test` (vitest; live Supabase tests read `.env.local` and skip without it), `npm run lint`, `npm run build`.
- Writes to the shared Supabase project need the user's explicit OK.
