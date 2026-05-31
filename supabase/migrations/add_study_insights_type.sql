-- Run in Supabase: SQL Editor → New query → Run
-- Allows 'insights' type in study_results for saved pattern analysis

do $$ begin
  alter table public.study_results drop constraint study_results_type_check;
exception when undefined_object then null;
end $$;

alter table public.study_results add constraint study_results_type_check
  check (type in ('upgrade', 'story', 'insights'));
