-- ============================================================
-- SurviveEnglish — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New query
-- ============================================================

-- Conversations
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  transcript text not null default '',
  duration_seconds integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Conversation groups (folders)
create table if not exists public.conversation_groups (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  conversation_ids text[] default '{}',
  created_at timestamptz default now() not null,
  archived_at timestamptz
);

-- Vocabulary items
create table if not exists public.vocabulary_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  word text not null,
  type text not null default 'word',
  source text,
  collection text,
  definition text,
  example_sentence text,
  korean_translation text,
  context text,
  is_mastered boolean not null default false,
  created_at timestamptz default now() not null
);

-- Migration: add collection column if upgrading from older schema
alter table public.vocabulary_items add column if not exists collection text;

-- Deep dive (예문 더 보기 / 어원)
alter table public.vocabulary_items add column if not exists extra_examples jsonb not null default '[]';
alter table public.vocabulary_items add column if not exists etymology text;
alter table public.vocabulary_items add column if not exists related_forms text;

-- Tutor sessions
create table if not exists public.tutor_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  messages jsonb not null default '[]',
  created_at timestamptz default now() not null
);

-- Vocabulary collection layouts (AI organized groupings)
create table if not exists public.vocabulary_collections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  layout jsonb not null default '[]'
);

-- Study results (Expression Upgrade & Story)
create table if not exists public.study_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('upgrade', 'story', 'insights')),
  title text not null,
  content jsonb not null default '{}',
  archived boolean not null default false,
  created_at timestamptz default now() not null
);

-- Migration: add study_results table if upgrading from older schema
alter table public.study_results add column if not exists archived boolean not null default false;

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.conversation_groups enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.tutor_sessions enable row level security;

create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own groups" on public.conversation_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own vocabulary" on public.vocabulary_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tutor sessions" on public.tutor_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.study_results enable row level security;
create policy "own study results" on public.study_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.vocabulary_collections enable row level security;
create policy "own vocab collections" on public.vocabulary_collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
