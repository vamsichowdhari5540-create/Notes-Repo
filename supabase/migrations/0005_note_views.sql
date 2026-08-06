-- Notes Repo: tracks the last time each user viewed each note, powering
-- the "Recently viewed" section on the dashboard.
-- Run after 0001-0004, in the Supabase SQL editor.

create table if not exists note_views (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, note_id)
);

create index if not exists idx_note_views_user_viewed_at
  on note_views (user_id, viewed_at desc);
