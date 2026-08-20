-- Notes Repo: "save for later" bookmarks — private per-user, unlike
-- upvotes/upvote_count which are public.
-- Run after 0001-0013, in the Supabase SQL editor.

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (note_id, user_id)
);

create index if not exists idx_bookmarks_note_id on bookmarks (note_id);
create index if not exists idx_bookmarks_user_id on bookmarks (user_id);

alter table bookmarks enable row level security;

drop policy if exists "Users can read their own bookmarks" on bookmarks;
create policy "Users can read their own bookmarks"
  on bookmarks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can bookmark notes as themselves" on bookmarks;
create policy "Users can bookmark notes as themselves"
  on bookmarks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own bookmark" on bookmarks;
create policy "Users can remove their own bookmark"
  on bookmarks for delete
  using (auth.uid() = user_id);
