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

create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_kind text not null,
  storage_path text,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  item_type text not null,
  upload_item_id text not null,
  source_record_id text not null,
  title text not null,
  summary text not null default '',
  facility text not null default '',
  event_date text not null default '',
  source_text text,
  extraction_status text not null default 'processed',
  extraction_model text not null default '',
  extraction jsonb not null,
  page_count integer,
  selected_pages integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_documents_kind_check check (source_kind in ('file', 'manual_text')),
  constraint source_documents_storage_check check (
    (source_kind = 'file' and storage_path is not null and source_text is null)
    or (source_kind = 'manual_text' and storage_path is null and source_text is not null)
  ),
  constraint source_documents_size_check check (size_bytes >= 0 and size_bytes <= 26214400),
  constraint source_documents_sha_check check (length(sha256) = 64),
  constraint source_documents_item_type_check check (item_type in ('document','medication','lab','voice','symptom','question','photo')),
  constraint source_documents_status_check check (extraction_status in ('processed','failed')),
  constraint source_documents_extraction_object check (jsonb_typeof(extraction) = 'object'),
  constraint source_documents_owner_upload_unique unique (owner_id, upload_item_id)
);

create index if not exists source_documents_owner_created_idx
on public.source_documents (owner_id, created_at desc);

create index if not exists source_documents_source_record_idx
on public.source_documents (owner_id, source_record_id);

alter table public.source_documents enable row level security;
grant select, insert, update, delete on public.source_documents to authenticated;

drop trigger if exists source_documents_set_updated_at on public.source_documents;
create trigger source_documents_set_updated_at
before update on public.source_documents
for each row execute function public.set_patient_record_updated_at();

drop policy if exists "owners read source documents" on public.source_documents;
create policy "owners read source documents"
on public.source_documents for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners create source documents" on public.source_documents;
create policy "owners create source documents"
on public.source_documents for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners update source documents" on public.source_documents;
create policy "owners update source documents"
on public.source_documents for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

drop policy if exists "owners delete source documents" on public.source_documents;
create policy "owners delete source documents"
on public.source_documents for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = owner_id);

comment on table public.source_documents is
'Private original-source metadata and extraction provenance for authenticated Vital Passport accounts. Original files live in the private patient-sources Storage bucket.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'patient-sources',
  'patient-sources',
  false,
  26214400,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own patient sources" on storage.objects;
create policy "users upload own patient sources"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'patient-sources'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "users read own patient sources" on storage.objects;
create policy "users read own patient sources"
on storage.objects for select
to authenticated
using (
  bucket_id = 'patient-sources'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "users update own patient sources" on storage.objects;
create policy "users update own patient sources"
on storage.objects for update
to authenticated
using (
  bucket_id = 'patient-sources'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'patient-sources'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "users delete own patient sources" on storage.objects;
create policy "users delete own patient sources"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'patient-sources'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

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
