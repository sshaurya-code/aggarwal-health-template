-- Daily care: timed home readings, medicine schedules and a log of every dose given.
alter table readings add column taken_time time; -- IST clock time for home readings; null for report values

alter table medications add column times text[] not null default '{}'; -- daily dose slots, "08:00" in IST

create table doses (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  due_on date not null,
  slot text not null,
  given_at timestamptz not null default now(),
  given_by text not null check (given_by in ('family', 'helper')),
  unique (medication_id, due_on, slot)
);
create index on doses (member_id, due_on);
alter table doses enable row level security;
