-- API keys for REST + MCP access (hashed; plaintext shown once at creation)

create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'default',
  key_prefix text not null,
  key_hash text not null unique,
  created_at timestamptz default now() not null,
  last_used_at timestamptz
);

create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

alter table public.api_keys enable row level security;

drop policy if exists "own api keys" on public.api_keys;
create policy "own api keys" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
