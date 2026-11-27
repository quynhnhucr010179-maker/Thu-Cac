-- THƯ CÁ cloud sync: run the complete script in Supabase SQL Editor.
-- The browser uses only the publishable key. Never place service_role keys in this project.
create table if not exists public.thuca_library (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"stories":[],"videos":[],"shelf":[],"progress":{}}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.thuca_library add column if not exists revision bigint not null default 1;
alter table public.thuca_library enable row level security;

drop policy if exists "THU CA owner can read own library" on public.thuca_library;
create policy "THU CA owner can read own library" on public.thuca_library
 for select to authenticated using (auth.uid() = owner_id);
drop policy if exists "THU CA owner can create own library" on public.thuca_library;
create policy "THU CA owner can create own library" on public.thuca_library
 for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "THU CA owner can update own library" on public.thuca_library;
create policy "THU CA owner can update own library" on public.thuca_library
 for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update on public.thuca_library to authenticated;
revoke all on public.thuca_library from anon;

-- Enable Postgres Changes so other signed-in devices receive updates.
do $$ begin
 alter publication supabase_realtime add table public.thuca_library;
exception
 when duplicate_object then null;
 when undefined_object then null;
end $$;

-- Private bucket for uploaded video files. A user's files live under <auth.uid>/<video-id>/.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('thuca-videos','thuca-videos',false,52428800,
 array['video/mp4','video/webm','video/quicktime','video/x-matroska','video/ogg'])
on conflict (id) do update set public=false,file_size_limit=52428800;

drop policy if exists "THU CA users read own videos" on storage.objects;
create policy "THU CA users read own videos" on storage.objects
 for select to authenticated using (bucket_id='thuca-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "THU CA users upload own videos" on storage.objects;
create policy "THU CA users upload own videos" on storage.objects
 for insert to authenticated with check (bucket_id='thuca-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "THU CA users update own videos" on storage.objects;
create policy "THU CA users update own videos" on storage.objects
 for update to authenticated using (bucket_id='thuca-videos' and (storage.foldername(name))[1]=auth.uid()::text)
 with check (bucket_id='thuca-videos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "THU CA users delete own videos" on storage.objects;
create policy "THU CA users delete own videos" on storage.objects
 for delete to authenticated using (bucket_id='thuca-videos' and (storage.foldername(name))[1]=auth.uid()::text);

comment on table public.thuca_library is 'THU CA per-user library snapshot with optimistic revision checks.';


-- Shared catalogue: every authenticated THU CA account reads and contributes to
-- the same global library. Keep the old per-user table intact for safe rollback.
create table if not exists public.thuca_shared_library (
  id text primary key check (id = 'global'),
  payload jsonb not null default '{"stories":[],"videos":[],"shelf":[],"progress":{}}'::jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.thuca_shared_library enable row level security;
drop policy if exists "THU CA signed-in users read shared library" on public.thuca_shared_library;
create policy "THU CA signed-in users read shared library" on public.thuca_shared_library
 for select to authenticated using (true);
drop policy if exists "THU CA signed-in users create shared library" on public.thuca_shared_library;
create policy "THU CA signed-in users create shared library" on public.thuca_shared_library
 for insert to authenticated with check (id = 'global');
drop policy if exists "THU CA signed-in users update shared library" on public.thuca_shared_library;
create policy "THU CA signed-in users update shared library" on public.thuca_shared_library
 for update to authenticated using (true) with check (id = 'global');
grant select, insert, update on public.thuca_shared_library to authenticated;
revoke all on public.thuca_shared_library from anon;

do $$ begin
 alter publication supabase_realtime add table public.thuca_shared_library;
exception when duplicate_object then null;
end $$;

-- All signed-in accounts may play shared videos, while uploads remain under
-- the uploader's own folder. This does not make the bucket public.
drop policy if exists "THU CA users read own videos" on storage.objects;
drop policy if exists "THU CA authenticated users read shared videos" on storage.objects;
create policy "THU CA authenticated users read shared videos" on storage.objects
 for select to authenticated using (bucket_id='thuca-videos');


-- Private account data: each account owns its own shelf and reading progress.
create table if not exists public.thuca_user_library (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null default '{"shelf":[],"progress":{}}'::jsonb,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.thuca_user_library enable row level security;
drop policy if exists "THU CA users read own personal library" on public.thuca_user_library;
create policy "THU CA users read own personal library" on public.thuca_user_library for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists "THU CA users create own personal library" on public.thuca_user_library;
create policy "THU CA users create own personal library" on public.thuca_user_library for insert to authenticated with check ((select auth.uid())=owner_id);
drop policy if exists "THU CA users update own personal library" on public.thuca_user_library;
create policy "THU CA users update own personal library" on public.thuca_user_library for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
grant select,insert,update on public.thuca_user_library to authenticated;
revoke all on public.thuca_user_library from anon;
do $$ begin alter publication supabase_realtime add table public.thuca_user_library; exception when duplicate_object then null; end $$;
comment on table public.thuca_user_library is 'THU CA private per-account shelf and reading progress.';
