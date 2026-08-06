-- Notes Repo: storage bucket for uploaded note files.
-- Run after 0001/0002, in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('notes', 'notes', true)
on conflict (id) do nothing;

drop policy if exists "Public read access on notes bucket" on storage.objects;
create policy "Public read access on notes bucket"
  on storage.objects for select
  using (bucket_id = 'notes');

drop policy if exists "Authenticated users can upload to notes bucket" on storage.objects;
create policy "Authenticated users can upload to notes bucket"
  on storage.objects for insert
  with check (bucket_id = 'notes' and auth.role() = 'authenticated');
