-- Notes Repo: row level security.
-- The app talks to Supabase with the public anon key from the browser, so
-- without RLS any client can read/write every row in every table directly
-- via the REST API. Run after 0001-0006, in the Supabase SQL editor.

alter table users enable row level security;
alter table subjects enable row level security;
alter table units enable row level security;
alter table notes enable row level security;
alter table tags enable row level security;
alter table note_tags enable row level security;
alter table upvotes enable row level security;
alter table note_views enable row level security;

-- users: profile rows are publicly readable (uploader names, leaderboard),
-- but a user can only ever modify their own row. Inserts happen only via
-- the security-definer handle_new_user() trigger, so no insert policy.
drop policy if exists "Public read access on users" on users;
create policy "Public read access on users"
  on users for select
  using (true);

drop policy if exists "Users can update their own profile" on users;
create policy "Users can update their own profile"
  on users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- subjects/units/tags: shared reference data, readable by everyone.
drop policy if exists "Public read access on subjects" on subjects;
create policy "Public read access on subjects"
  on subjects for select
  using (true);

drop policy if exists "Public read access on units" on units;
create policy "Public read access on units"
  on units for select
  using (true);

drop policy if exists "Public read access on tags" on tags;
create policy "Public read access on tags"
  on tags for select
  using (true);

drop policy if exists "Authenticated users can create tags" on tags;
create policy "Authenticated users can create tags"
  on tags for insert
  with check (auth.role() = 'authenticated');

-- notes: publicly readable, but only the uploader can create/edit/delete
-- their own notes.
drop policy if exists "Public read access on notes" on notes;
create policy "Public read access on notes"
  on notes for select
  using (true);

drop policy if exists "Users can insert their own notes" on notes;
create policy "Users can insert their own notes"
  on notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notes" on notes;
create policy "Users can update their own notes"
  on notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notes" on notes;
create policy "Users can delete their own notes"
  on notes for delete
  using (auth.uid() = user_id);

-- note_tags: publicly readable, but only the note's owner can attach/detach
-- tags on it.
drop policy if exists "Public read access on note_tags" on note_tags;
create policy "Public read access on note_tags"
  on note_tags for select
  using (true);

drop policy if exists "Note owners can tag their notes" on note_tags;
create policy "Note owners can tag their notes"
  on note_tags for insert
  with check (
    exists (
      select 1 from notes
      where notes.id = note_tags.note_id and notes.user_id = auth.uid()
    )
  );

drop policy if exists "Note owners can untag their notes" on note_tags;
create policy "Note owners can untag their notes"
  on note_tags for delete
  using (
    exists (
      select 1 from notes
      where notes.id = note_tags.note_id and notes.user_id = auth.uid()
    )
  );

-- upvotes: publicly readable (upvote counts/leaderboard), but a user can
-- only cast or remove their own upvote.
drop policy if exists "Public read access on upvotes" on upvotes;
create policy "Public read access on upvotes"
  on upvotes for select
  using (true);

drop policy if exists "Users can upvote as themselves" on upvotes;
create policy "Users can upvote as themselves"
  on upvotes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own upvote" on upvotes;
create policy "Users can remove their own upvote"
  on upvotes for delete
  using (auth.uid() = user_id);

-- note_views: purely personal "recently viewed" history — only visible to
-- and writable by the viewing user.
drop policy if exists "Users can read their own view history" on note_views;
create policy "Users can read their own view history"
  on note_views for select
  using (auth.uid() = user_id);

drop policy if exists "Users can record their own views" on note_views;
create policy "Users can record their own views"
  on note_views for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own view history" on note_views;
create policy "Users can update their own view history"
  on note_views for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
