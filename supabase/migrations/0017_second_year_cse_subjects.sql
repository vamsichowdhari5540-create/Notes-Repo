-- Notes Repo: Second Year CSE subjects.
-- Run after 0001-0016, in the Supabase SQL editor.

insert into subjects (name, code, branch, year) values
  ('DMGT — Discrete Mathematics and Graph Theory', '23A11111A', 'CSE', 2),
  ('MEFA — Managerial Economics and Financial Analysis', '23A11203A', 'CSE', 2),
  ('DLCO — Digital Logic and Computer Organization', '23A05305A', 'CSE', 2),
  ('ADSA — Advanced Data Structures and Algorithm Analysis', '23A05403A', 'CSE', 2),
  ('OOPS — Object Oriented Programming through Java', '23A05404A', 'CSE', 2),
  ('DTI — Design Thinking and Innovation', '23A05306A', 'CSE', 2),
  ('UHV — Universal Human Values - Understanding Harmony', '23A11204A', 'CSE', 2),
  ('P & S — Probability and Statistics', '23A11112A', 'CSE', 2),
  ('OS — Operating Systems', '23A05407A', 'CSE', 2),
  ('DBMS — Database Management Systems', '23A05408A', 'CSE', 2),
  ('SE — Software Engineering', '23A05409A', 'CSE', 2)
on conflict (code) do nothing;

insert into units (subject_id, unit_number, title)
select s.id, n, 'Unit ' || n
from subjects s
cross join generate_series(1, 5) as n
where s.name in (
  'DMGT — Discrete Mathematics and Graph Theory',
  'MEFA — Managerial Economics and Financial Analysis',
  'DLCO — Digital Logic and Computer Organization',
  'ADSA — Advanced Data Structures and Algorithm Analysis',
  'OOPS — Object Oriented Programming through Java',
  'DTI — Design Thinking and Innovation',
  'UHV — Universal Human Values - Understanding Harmony',
  'P & S — Probability and Statistics',
  'OS — Operating Systems',
  'DBMS — Database Management Systems',
  'SE — Software Engineering'
)
on conflict (subject_id, unit_number) do nothing;
