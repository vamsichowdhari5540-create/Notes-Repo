-- Notes Repo: year-of-study filter for subjects (First Year .. Final Year).
-- Run after 0001-0007, in the Supabase SQL editor.

alter table subjects add column if not exists year int;

alter table subjects drop constraint if exists subjects_year_range;
alter table subjects add constraint subjects_year_range check (year is null or year between 1 and 4);

-- Existing subjects (ATCD, BAI, CN, ESPS, IQTA, OOAD) are Third Year
-- subjects — backfill them accordingly rather than leaving them
-- unfiltered/invisible under the new UI.
update subjects set year = 3 where year is null;
