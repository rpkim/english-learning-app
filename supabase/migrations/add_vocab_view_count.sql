-- Run in Supabase: SQL Editor → New query → Run
-- Tracks how many times a learner reviewed a vocabulary item

alter table public.vocabulary_items add column if not exists view_count integer not null default 0;
