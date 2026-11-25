-- THU CA cloud sync schema
-- Run this in Supabase SQL Editor. Browser clients use Auth + RLS.
create table if not exists public.thuca_library (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"stories":[],"videos":[],"shelf":[],"progress":{}}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.thuca_library enable row level security;

drop policy if exists "THU CA owner can read own library" on public.thuca_library;
create policy "THU CA owner can read own library"
  on public.thuca_library for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "THU CA owner can create own library" on public.thuca_library;
create policy "THU CA owner can create own library"
  on public.thuca_library for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "THU CA owner can update own library" on public.thuca_library;
create policy "THU CA owner can update own library"
  on public.thuca_library for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant select, insert, update on public.thuca_library to authenticated;
revoke all on public.thuca_library from anon;

comment on table public.thuca_library is
  'THU CA per-user library snapshot. Keep local JSON backups before first migration.';
