-- Ensure the signed-in role can manage its own hashed API keys (RLS still applies).
grant select, insert, update, delete on table public.api_keys to authenticated;
