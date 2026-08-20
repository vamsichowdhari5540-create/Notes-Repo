-- Notes Repo: full-text search over note title, description, and extracted
-- file content (the same text moderation already pulls from PDFs/DOCX at
-- upload time, now persisted and indexed instead of thrown away).
-- Run after 0001-0011, in the Supabase SQL editor.

alter table notes add column if not exists content_text text;

alter table notes add column if not exists content_tsv tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'C')
  ) stored;

create index if not exists idx_notes_content_tsv on notes using gin (content_tsv);
