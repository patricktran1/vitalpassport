create extension if not exists pgcrypto;

create table if not exists public.patient_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  record jsonb not null,
  schema_version integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_records_record_object check (jsonb_typeof(record) = 'object')
);

alter table public.patient_records alter column schema_version set default 2;
alter table public.patient_records enable row level security;
grant select, insert, update, delete on public.patient_records to authenticated;

create or replace function public.set_patient_record_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patient_records_set_updated_at on public.patient_records;
create trigger patient_records_set_updated_at
before update on public.patient_records
for each row execute function public.set_patient_record_updated_at();

revoke all on function public.set_patient_record_updated_at() from public;

drop policy if exists "read own record" on public.patient_records;
create policy "read own record"
on public.patient_records for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "create own record" on public.patient_records;
create policy "create own record"
on public.patient_records for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "update own record" on public.patient_records;
create policy "update own record"
on public.patient_records for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "delete own record" on public.patient_records;
create policy "delete own record"
on public.patient_records for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

comment on table public.patient_records is
'One versioned Vital Passport cloud bundle per authenticated account. Bundle schema v2 contains the core clinical record plus selected patient-controlled browser modules.';

create table if not exists public.shared_briefs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  packet jsonb not null,
  label text not null default 'Clinician brief',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shared_briefs_packet_object check (jsonb_typeof(packet) = 'object')
);

create index if not exists shared_briefs_owner_created_idx
on public.shared_briefs (owner_id, created_at desc);

create index if not exists shared_briefs_token_hash_idx
on public.shared_briefs (token_hash);

alter table public.shared_briefs enable row level security;
grant select, insert, update, delete on public.shared_briefs to authenticated;

drop policy if exists "owners read shared briefs" on public.shared_briefs;
create policy "owners read shared briefs"
on public.shared_briefs for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners create shared briefs" on public.shared_briefs;
create policy "owners create shared briefs"
on public.shared_briefs for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners update shared briefs" on public.shared_briefs;
create policy "owners update shared briefs"
on public.shared_briefs for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners delete shared briefs" on public.shared_briefs;
create policy "owners delete shared briefs"
on public.shared_briefs for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

create or replace function public.get_shared_brief(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_share public.shared_briefs%rowtype;
begin
  if p_token is null or length(p_token) < 32 then
    return null;
  end if;

  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  select * into v_share
  from public.shared_briefs
  where token_hash = v_hash
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if not found then
    return null;
  end if;

  update public.shared_briefs
  set access_count = access_count + 1,
      last_accessed_at = now()
  where id = v_share.id;

  return jsonb_build_object(
    'packet', v_share.packet,
    'created_at', v_share.created_at,
    'expires_at', v_share.expires_at,
    'access_count', v_share.access_count + 1
  );
end;
$$;

revoke all on function public.get_shared_brief(text) from public;
grant execute on function public.get_shared_brief(text) to anon, authenticated;
