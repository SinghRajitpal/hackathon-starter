-- Record of every schema change run in the Supabase SQL Editor.
-- Append new SQL at the bottom, newest last, with a short comment.
-- Every table needs RLS enabled and at least one policy.

-- Example (not yet applied):
--
-- create table public.todos (
--   id bigint generated always as identity primary key,
--   user_id uuid not null default auth.uid() references auth.users (id),
--   task text not null,
--   created_at timestamptz not null default now()
-- );
--
-- alter table public.todos enable row level security;
--
-- create policy "own rows" on public.todos
--   for all to authenticated
--   using ((select auth.uid()) = user_id)
--   with check ((select auth.uid()) = user_id);

-- favorite_animals: one favorite animal per user
create table public.favorite_animals (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id),
  animal text not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.favorite_animals enable row level security;

create policy "own rows" on public.favorite_animals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
