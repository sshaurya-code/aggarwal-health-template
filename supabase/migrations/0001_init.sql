-- Family Health — run once in the Supabase SQL Editor.
-- All access goes through the server with the service-role key, so RLS is on
-- with no policies: the public anon key can read nothing.

create table members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  relation text,
  dob date,
  sex text check (sex in ('male', 'female')),
  blood_group text,
  height_cm numeric,
  conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  notes text,
  review text,
  review_at timestamptz,
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  kind text not null default 'other'
    check (kind in ('lab_report', 'prescription', 'imaging', 'discharge', 'consultation', 'vaccination', 'other')),
  title text not null default 'Untitled document',
  doc_date date,
  lab_name text,
  doctor text,
  patient_name text,
  summary text,
  text text, -- text layer of a digital PDF, pulled out on the phone
  files text[] not null default '{}',
  mime text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed', 'manual')),
  error text,
  created_at timestamptz not null default now()
);
create index on documents (member_id, doc_date desc);

create table readings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  marker_key text not null,
  marker_name text not null,
  value numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  flag text check (flag in ('low', 'high', 'normal')),
  taken_at date not null default current_date,
  source text not null default 'report' check (source in ('report', 'manual')),
  created_at timestamptz not null default now()
);
create index on readings (member_id, marker_key, taken_at desc);

create table medications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  document_id uuid references documents(id) on delete set null,
  name text not null,
  dose text,
  frequency text,
  started_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table members enable row level security;
alter table documents enable row level security;
alter table readings enable row level security;
alter table medications enable row level security;

insert into storage.buckets (id, name, public) values ('records', 'records', false)
on conflict (id) do nothing;
