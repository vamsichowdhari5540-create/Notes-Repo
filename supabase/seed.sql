-- Notes Repo: seed data
-- Run after 0001_init.sql, in the Supabase SQL editor.
-- Subjects + units + tags only — no fake notes (upload real ones via the app).

insert into subjects (name, code) values
  ('IQTA', 'IQTA'),
  ('OOAD', 'OOAD'),
  ('CN', 'CN'),
  ('BAI', 'BAI'),
  ('ATCD', 'ATCD'),
  ('ESPS', 'ESPS')
on conflict (code) do nothing;

insert into units (subject_id, unit_number, title)
select s.id, n, 'Unit ' || n
from subjects s
cross join generate_series(1, 5) as n
where s.code in ('IQTA', 'OOAD', 'CN', 'BAI', 'ATCD', 'ESPS')
on conflict (subject_id, unit_number) do nothing;

insert into tags (name) values
  ('exam-important'),
  ('unit-1'),
  ('unit-2'),
  ('unit-3'),
  ('unit-4'),
  ('unit-5'),
  ('diagrams'),
  ('cheat-sheet'),
  ('previous-papers'),
  ('assignments')
on conflict (name) do nothing;
