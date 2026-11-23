-- Family vault: IDs, bills and insurance live alongside medical documents.

alter table documents add column category text not null default 'health'
  check (category in ('health', 'id', 'bill', 'insurance'));
alter table documents add column details jsonb not null default '{}';
alter table documents add column expires_on date; -- ID expiry, warranty end or policy end
alter table documents alter column member_id drop not null; -- null = the whole household

alter table documents drop constraint if exists documents_kind_check;
alter table documents add constraint documents_kind_check check (kind in (
  'lab_report', 'prescription', 'imaging', 'discharge', 'consultation', 'vaccination', 'other',
  'aadhaar', 'pan', 'passport', 'driving_licence', 'voter_id', 'id_other',
  'bill',
  'health_cover', 'motor_cover', 'life_cover', 'home_cover', 'travel_cover', 'other_cover'
));

create index on documents (expires_on) where expires_on is not null;

-- One row per iPhone that turned on reminders.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  member_id uuid references members(id) on delete cascade, -- null = reminders for everyone
  created_at timestamptz not null default now()
);

-- Which reminder stage each phone has already been sent, so the daily job never repeats one.
create table reminders_sent (
  subscription_id uuid not null references push_subscriptions(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (subscription_id, key)
);

alter table push_subscriptions enable row level security;
alter table reminders_sent enable row level security;
