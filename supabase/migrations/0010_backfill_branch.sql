-- Notes Repo: backfill branch for existing subjects.
-- Run after 0001-0009, in the Supabase SQL editor.

update subjects set branch = 'CSE' where branch is null;
