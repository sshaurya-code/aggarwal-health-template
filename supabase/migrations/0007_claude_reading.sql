-- Claude reads documents; new Cars and Others sections; a hard spending cap.

alter table documents drop constraint documents_category_check;
alter table documents add constraint documents_category_check
  check (category in ('health', 'id', 'bill', 'insurance', 'car', 'other'));

alter table documents drop constraint documents_kind_check;
alter table documents add constraint documents_kind_check check (kind in (
  'lab_report', 'prescription', 'imaging', 'discharge', 'consultation', 'vaccination', 'other',
  'aadhaar', 'pan', 'passport', 'driving_licence', 'voter_id', 'id_other',
  'bill',
  'health_cover', 'motor_cover', 'life_cover', 'home_cover', 'travel_cover', 'other_cover',
  'rc', 'puc', 'fitness', 'road_tax', 'permit', 'car_other',
  'misc'
));

-- Reading never touches status, so a saved document stays in reminders while a new draft waits.
alter table documents
  add column claude_state text check (claude_state in ('queued', 'reading', 'failed')),
  add column claude_error text,
  add column claude_at timestamptz, -- when the current read started
  add column draft jsonb,           -- Claude's reading, waiting for someone to check it
  add column claude_read jsonb,     -- Claude's reading as it was when the draft was saved
  add column checked text[] not null default '{}'; -- disagreements someone confirmed: "field=Claude's value"

create index on documents (claude_state) where claude_state is not null;

-- Every Claude call, in rupees. A row is reserved at the worst-case cost before the call and
-- settled to the real cost after it, so the total can never pass the cap.
create table claude_spend (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  document_id uuid references documents(id) on delete set null,
  inr numeric not null,
  settled boolean not null default false,
  input_tokens int,
  output_tokens int
);
alter table claude_spend enable row level security;

-- Reserves `est` rupees if the running total stays within `cap`; returns the row id, or null when it wouldn't.
-- The table lock makes two reads at the same moment queue up instead of both squeezing under the cap.
create function reserve_claude_spend(doc uuid, est numeric, cap numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  lock table claude_spend in share row exclusive mode;
  if (select coalesce(sum(inr), 0) from claude_spend) + est > cap then
    return null;
  end if;
  insert into claude_spend (document_id, inr) values (doc, est) returning id into new_id;
  return new_id;
end $$;
revoke execute on function reserve_claude_spend(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function reserve_claude_spend(uuid, numeric, numeric) to service_role;
