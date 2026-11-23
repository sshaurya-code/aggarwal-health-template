-- Copy of every file in the user's Google Drive.
alter table documents add column drive jsonb not null default '{}'; -- storage path → { id, folder, name } of its Drive copy

create table drive_folders (
  path text primary key, -- "<Family>/<Person>/Health"
  id text not null
);
alter table drive_folders enable row level security;
