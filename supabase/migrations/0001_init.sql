-- Notes Repo: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- Profile row for each authenticated user (1:1 with auth.users).
create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  branch text,
  year int,
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  branch text,
  semester int,
  created_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  unit_number int not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (subject_id, unit_number)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  unit_id uuid not null references units (id) on delete cascade,
  title text not null,
  file_url text not null,
  file_type text not null,
  description text,
  upvote_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists note_tags (
  note_id uuid not null references notes (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create table if not exists upvotes (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (note_id, user_id)
);

-- Lookup indexes for the join/filter patterns the app uses.
create index if not exists idx_units_subject_id on units (subject_id);
create index if not exists idx_notes_unit_id on notes (unit_id);
create index if not exists idx_notes_user_id on notes (user_id);
create index if not exists idx_note_tags_tag_id on note_tags (tag_id);
create index if not exists idx_upvotes_note_id on upvotes (note_id);
