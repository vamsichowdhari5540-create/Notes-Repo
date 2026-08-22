-- Notes Repo: Third Year CSE — expand existing subject names/codes, add new subjects.
-- Run after 0001-0017, in the Supabase SQL editor.

-- Expand existing short-code subjects into full name + official code.
update subjects set name = 'IQTA — Introduction to Quantum Technology and Applications', code = '23A99401A'
  where code = 'IQTA' and branch = 'CSE' and year = 3;
update subjects set name = 'OOAD — Object Oriented Analysis and Design', code = '23A05414A'
  where code = 'OOAD' and branch = 'CSE' and year = 3;
update subjects set name = 'CN — Computer Networks', code = '23A35402A'
  where code = 'CN' and branch = 'CSE' and year = 3;
update subjects set name = 'BAI — Basics of Artificial Intelligence', code = '23A05412A'
  where code = 'BAI' and branch = 'CSE' and year = 3;
update subjects set name = 'ATCD — Automata Theory and Compiler Design', code = '23A05413A'
  where code = 'ATCD' and branch = 'CSE' and year = 3;
-- ESPS: no official code supplied yet, so only the name is expanded; code stays 'ESPS' for now.
update subjects set name = 'ESPS — Electrical Safety Practices and Standards'
  where code = 'ESPS' and branch = 'CSE' and year = 3;

-- New Third Year CSE subjects.
insert into subjects (name, code, branch, year) values
  ('IML — Introduction to Machine Learning', '23A05419A', 'CSE', 3),
  ('CC — Cloud Computing', '23A05420A', 'CSE', 3),
  ('CNS — Cryptography and Network Security', '23A05421A', 'CSE', 3)
on conflict (code) do nothing;

insert into units (subject_id, unit_number, title)
select s.id, n, 'Unit ' || n
from subjects s
cross join generate_series(1, 5) as n
where s.code in ('23A05419A', '23A05420A', '23A05421A')
on conflict (subject_id, unit_number) do nothing;
