# Hackathon Starter

Next.js + Supabase app for our hackathon team. Every push to `main` deploys to Vercel automatically.

Built from the official [`with-supabase`](https://github.com/vercel/next.js/tree/canary/examples/with-supabase) template: email/password sign-up, login, password reset, and a protected page are already wired up.

## Run it locally

Requires Node.js 20 or newer.

```bash
git clone https://github.com/SinghRajitpal/hackathon-starter.git
cd hackathon-starter
npm install
cp .env.example .env.local
npm run dev
```

Fill in `.env.local` with the values from the Supabase dashboard (**Project > Connect**, or **Project Settings > API Keys**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Open http://localhost:3000.

## Push loop

```bash
git add .
git commit -m "feat: short description"
git pull --rebase   # get teammates' work first
git push            # live on Vercel in about a minute
```

- Vercel Hobby allows 100 deployments per day, and every push counts. Commit often, push in batches.
- Force pushes to `main` are blocked.

## Database changes

1. Write and run the SQL in **Supabase > SQL Editor**. One person changes the schema at a time.
2. Tell the team in chat what changed.
3. Append the same SQL to [`supabase/schema.sql`](supabase/schema.sql) and commit it.
4. Every table gets row level security (RLS) and a policy. The repo and the publishable key are public, so RLS is what protects the data.

## Rules

- Never commit `.env.local` or any secret key.
- Never put the Supabase secret key (or legacy `service_role` key) in a `NEXT_PUBLIC_` variable. Those are sent to the browser.
- Demo day: freeze `main` 30 minutes before judging.
