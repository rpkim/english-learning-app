-- Run in Supabase: SQL Editor → New query → Run
-- Creates study_results table for Study History (Expression Upgrade & Story)

create table if not exists public.study_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('upgrade', 'story')),
  title text not null,
  content jsonb not null default '{}',
  archived boolean not null default false,
  created_at timestamptz default now() not null
);

alter table public.study_results enable row level security;

do $$ begin
  create policy "own study results" on public.study_results
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
