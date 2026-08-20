-- Notes Repo: "new notes for your subjects" notification bell.
-- "Your subjects" = subjects you've uploaded to, viewed a note in, or
-- upvoted a note in — inferred from existing activity, no separate
-- follow/subscribe table needed.
-- Run after 0001-0012, in the Supabase SQL editor.

alter table users add column if not exists notifications_last_seen_at timestamptz not null default now();

create or replace function get_new_notes_for_user(p_user_id uuid, p_since timestamptz, p_limit int default 20)
returns table (
  note_id uuid,
  title text,
  unit_id uuid,
  subject_id uuid,
  subject_name text,
  created_at timestamptz
)
language sql
stable
security invoker
as $$
  with my_subjects as (
    select distinct u.subject_id
    from units u
    join notes n on n.unit_id = u.id
    where n.user_id = p_user_id
    union
    select distinct u.subject_id
    from units u
    join notes n on n.unit_id = u.id
    join note_views nv on nv.note_id = n.id
    where nv.user_id = p_user_id
    union
    select distinct u.subject_id
    from units u
    join notes n on n.unit_id = u.id
    join upvotes up on up.note_id = n.id
    where up.user_id = p_user_id
  )
  select n.id, n.title, n.unit_id, u.subject_id, s.name, n.created_at
  from notes n
  join units u on u.id = n.unit_id
  join subjects s on s.id = u.subject_id
  where u.subject_id in (select subject_id from my_subjects)
    and n.created_at > p_since
    and n.user_id <> p_user_id
  order by n.created_at desc
  limit p_limit;
$$;

grant execute on function get_new_notes_for_user(uuid, timestamptz, int) to authenticated;
