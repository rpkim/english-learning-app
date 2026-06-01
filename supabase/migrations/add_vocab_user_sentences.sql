-- Run in Supabase: SQL Editor → New query → Run
-- User-saved practice sentences per vocabulary item

alter table public.vocabulary_items add column if not exists user_sentences jsonb not null default '[]';
