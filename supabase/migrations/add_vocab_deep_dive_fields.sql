-- Run in Supabase: SQL Editor → New query → Run
-- Stores AI-generated extra examples and etymology per vocabulary item

alter table public.vocabulary_items add column if not exists extra_examples jsonb not null default '[]';
alter table public.vocabulary_items add column if not exists etymology text;
alter table public.vocabulary_items add column if not exists related_forms text;
