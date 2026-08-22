-- Notes Repo: harden the notes storage bucket.
-- Run after 0001-0019, in the Supabase SQL editor.
--
-- Previously any authenticated user could upload to ANY path in the notes
-- bucket (the "userId/..." folder convention was only enforced client-side,
-- not by RLS), and there was no delete policy at all — so the app's own
-- reject-cleanup and note-delete flows silently failed to remove files,
-- leaving them orphaned in storage.

drop policy if exists "Authenticated users can upload to notes bucket" on storage.objects;
create policy "Users can upload to their own folder in notes bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'notes'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own files in notes bucket" on storage.objects;
create policy "Users can delete their own files in notes bucket"
  on storage.objects for delete
  using (
    bucket_id = 'notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
