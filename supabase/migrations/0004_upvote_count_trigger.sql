-- Notes Repo: keep notes.upvote_count in sync with the upvotes table.
-- Run after 0001-0003, in the Supabase SQL editor.
-- A trigger (not client-side increments) so the count stays correct
-- even when two people upvote/un-upvote the same note concurrently.

create or replace function public.handle_upvote_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.notes set upvote_count = upvote_count + 1 where id = new.note_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.notes set upvote_count = upvote_count - 1 where id = old.note_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists on_upvote_insert on upvotes;
create trigger on_upvote_insert
  after insert on upvotes
  for each row execute function public.handle_upvote_change();

drop trigger if exists on_upvote_delete on upvotes;
create trigger on_upvote_delete
  after delete on upvotes
  for each row execute function public.handle_upvote_change();
