-- Notes Repo: AI-generated summary + a genuine "AI-Verified" signal.
-- ai_verified is only set true when real moderation actually ran (not when
-- GROQ/GEMINI keys are missing and checks were skipped) — a badge that
-- claims verification without a real check behind it would be worse than
-- no badge at all.
-- Run after 0001-0015, in the Supabase SQL editor.

alter table notes add column if not exists summary text;
alter table notes add column if not exists ai_verified boolean not null default false;
