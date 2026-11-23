-- Wrong-PIN log, so guessing the PIN is throttled across every server instance.
create table login_failures (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  ip text
);
create index login_failures_at on login_failures (at);
alter table login_failures enable row level security;

