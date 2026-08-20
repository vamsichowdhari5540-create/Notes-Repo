-- Notes Repo: let users flag a note for review (wrong subject, spam,
-- inappropriate content, etc.) as a manual backstop to the AI moderation
-- that only runs at upload time.
-- Run after 0001-0010, in the Supabase SQL editor.

create table if not exists note_reports (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes (id) on delete cascade,
  reporter_id uuid not null references users (id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz not null default now(),
  unique (note_id, reporter_id)
);

create index if not exists idx_note_reports_note_id on note_reports (note_id);

alter table note_reports enable row level security;

-- Users can report a note as themselves, and see which notes they've
-- already reported (so the UI can show "Reported" instead of re-submitting).
-- There's no "admins can read everything" policy yet — review reports
-- directly in the Supabase table editor for now.
drop policy if exists "Users can report notes as themselves" on note_reports;
create policy "Users can report notes as themselves"
  on note_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can see their own reports" on note_reports;
create policy "Users can see their own reports"
  on note_reports for select
  using (auth.uid() = reporter_id);
