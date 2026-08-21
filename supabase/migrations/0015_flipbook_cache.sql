-- Notes Repo: cache for rendered flipbook pages.
-- Rendering a PDF's pages into images is CPU-heavy and can take tens of
-- seconds for large/image-heavy files. Caching the result means only the
-- first person to open a given note's flipbook pays that cost — everyone
-- after that gets a fast direct read instead of a re-render.
-- Run after 0001-0014, in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('flipbook-cache', 'flipbook-cache', true)
on conflict (id) do nothing;

drop policy if exists "Public read access on flipbook-cache bucket" on storage.objects;
create policy "Public read access on flipbook-cache bucket"
  on storage.objects for select
  using (bucket_id = 'flipbook-cache');

-- Written only by the render-pages server route (no end-user session), so
-- this allows the anon role specifically for this bucket — the content is
-- just re-derived renders of already-public note PDFs, not sensitive data.
drop policy if exists "Server can write flipbook-cache" on storage.objects;
create policy "Server can write flipbook-cache"
  on storage.objects for insert
  with check (bucket_id = 'flipbook-cache');

drop policy if exists "Server can update flipbook-cache" on storage.objects;
create policy "Server can update flipbook-cache"
  on storage.objects for update
  using (bucket_id = 'flipbook-cache');
