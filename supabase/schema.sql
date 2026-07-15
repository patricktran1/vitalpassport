create table if not exists public.patient_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  record jsonb not null,
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patient_records enable row level security;

create policy "read own record"
on public.patient_records for select
to authenticated
using (auth.uid() = user_id);

create policy "create own record"
on public.patient_records for insert
to authenticated
with check (auth.uid() = user_id);

create policy "update own record"
on public.patient_records for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
