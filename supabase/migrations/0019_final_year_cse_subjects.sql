-- Notes Repo: Final Year CSE subjects.
-- Run after 0001-0018, in the Supabase SQL editor.

insert into subjects (name, code, branch, year) values
  ('DL — Deep Learning', '23A39401A', 'CSE', 4),
  ('MS — Management Science', '23A11207A', 'CSE', 4),
  ('IOT — Internet of Things', '23A35405A', 'CSE', 4),
  ('AM — Agile Methodologies', '23A05432A', 'CSE', 4),
  ('PE — Prompt Engineering', '23A05705A', 'CSE', 4),
  ('SADP — Software Architecture and Design Patterns', '23A05430A', 'CSE', 4),
  ('MV — Metaverse', '23A05433A', 'CSE', 4),
  ('CV — Computer Vision', '23A39402A', 'CSE', 4),
  ('BT — Blockchain Technology', '23A35410A', 'CSE', 4),
  ('ARVR — Augmented Reality & Virtual Reality', '23A05431A', 'CSE', 4),
  ('CPS — Cyber Physical Systems', '23A05434A', 'CSE', 4)
on conflict (code) do nothing;

insert into units (subject_id, unit_number, title)
select s.id, n, 'Unit ' || n
from subjects s
cross join generate_series(1, 5) as n
where s.code in (
  '23A39401A', '23A11207A', '23A35405A', '23A05432A', '23A05705A',
  '23A05430A', '23A05433A', '23A39402A', '23A35410A', '23A05431A', '23A05434A'
)
on conflict (subject_id, unit_number) do nothing;
