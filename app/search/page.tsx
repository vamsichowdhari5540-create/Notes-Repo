"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { recordNoteView, searchNotesByTags, searchNotesByText } from "@/lib/notes";
import { CardSkeletonGrid } from "@/components/Skeleton";
import NoteCard from "@/components/NoteCard";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { NoteWithMeta, Tag } from "@/lib/types";

export default function SearchPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/signup");
    }
  }, [authLoading, user, router]);

  const [mode, setMode] = useState<"tags" | "keyword">("tags");

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<NoteWithMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const [keywordQuery, setKeywordQuery] = useState("");
  const [keywordNotes, setKeywordNotes] = useState<NoteWithMeta[]>([]);
  const [keywordLoading, setKeywordLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("tags")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAllTags(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (selectedTags.length === 0) {
      setNotes([]);
      return;
    }
    setLoading(true);
    searchNotesByTags(
      supabase,
      selectedTags.map((t) => t.id),
      user?.id ?? null
    )
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [selectedTags, supabase, user?.id]);

  useEffect(() => {
    const trimmed = keywordQuery.trim();
    if (!trimmed) {
      setKeywordNotes([]);
      return;
    }
    setKeywordLoading(true);
    const timer = setTimeout(() => {
      searchNotesByText(supabase, trimmed, user?.id ?? null)
        .then(setKeywordNotes)
        .catch(() => setKeywordNotes([]))
        .finally(() => setKeywordLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordQuery, supabase, user?.id]);

  const suggestions = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      !selectedTags.some((t) => t.id === tag.id)
  );

  function addTag(tag: Tag) {
    setSelectedTags((prev) => [...prev, tag]);
    setQuery("");
  }

  function removeTag(tagId: string) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  function handleView(noteId: string) {
    if (!user) return;
    recordNoteView(supabase, noteId, user.id);
  }

  function makeToggleUpvote(
    list: NoteWithMeta[],
    setList: (updater: (prev: NoteWithMeta[]) => NoteWithMeta[]) => void
  ) {
    return async function toggleUpvote(noteId: string) {
      if (!user) {
        router.push("/login");
        return;
      }

      const note = list.find((n) => n.id === noteId);
      if (!note) return;

      setList((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? {
                ...n,
                upvoted_by_me: !n.upvoted_by_me,
                upvote_count: n.upvote_count + (n.upvoted_by_me ? -1 : 1),
              }
            : n
        )
      );

      const { error } = note.upvoted_by_me
        ? await supabase
            .from("upvotes")
            .delete()
            .eq("note_id", noteId)
            .eq("user_id", user.id)
        : await supabase.from("upvotes").insert({ note_id: noteId, user_id: user.id });

      if (error) {
        console.error("Toggle upvote failed:", error);
        setList((prev) => prev.map((n) => (n.id === noteId ? note : n)));
        return;
      }

      const { data } = await supabase
        .from("notes")
        .select("upvote_count")
        .eq("id", noteId)
        .single();
      if (data) {
        setList((prev) =>
          prev.map((n) =>
            n.id === noteId ? { ...n, upvote_count: data.upvote_count } : n
          )
        );
      }
    };
  }

  const toggleTagUpvote = makeToggleUpvote(notes, setNotes);
  const toggleKeywordUpvote = makeToggleUpvote(keywordNotes, setKeywordNotes);

  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <p className="mt-2 text-[var(--muted)]">
        {mode === "tags"
          ? "Pick one or more tags — notes matching the most tags show up first."
          : "Search titles, descriptions, and the text inside uploaded PDFs and DOCX files."}
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("tags")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "tags"
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/25"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          }`}
        >
          By tag
        </button>
        <button
          type="button"
          onClick={() => setMode("keyword")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === "keyword"
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/25"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          }`}
        >
          By keyword
        </button>
      </div>

      {mode === "keyword" ? (
        <div className="mt-6">
          <input
            type="text"
            value={keywordQuery}
            onChange={(e) => setKeywordQuery(e.target.value)}
            placeholder="Search notes by title, description, or content…"
            className="w-full rounded-xl border border-white/40 bg-white/60 px-4 py-2.5 text-sm text-slate-900 shadow-lg shadow-slate-900/5 backdrop-blur-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />

          <div className="mt-8">
            {!keywordQuery.trim() ? (
              <p className="text-[var(--muted)]">Type something above to start searching.</p>
            ) : keywordLoading ? (
              <CardSkeletonGrid count={4} />
            ) : keywordNotes.length === 0 ? (
              <p className="text-[var(--muted)]">No notes match &ldquo;{keywordQuery.trim()}&rdquo;.</p>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {keywordNotes.map((note) => (
                  <motion.div key={note.id} variants={fadeInUp}>
                    <NoteCard
                      note={note}
                      onToggleUpvote={toggleKeywordUpvote}
                      onView={handleView}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6">
            {selectedTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <AnimatePresence>
                  {selectedTags.map((tag) => (
                    <motion.span
                      key={tag.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        className="text-slate-400 hover:text-slate-600"
                        aria-label={`Remove ${tag.name}`}
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tags…"
                className="w-full rounded-xl border border-white/40 bg-white/60 px-4 py-2.5 text-sm text-slate-900 shadow-lg shadow-slate-900/5 backdrop-blur-xl outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
              {query.trim() && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-white/40 bg-white/80 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/80">
                  {suggestions.slice(0, 8).map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => addTag(tag)}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            {selectedTags.length === 0 ? (
              <p className="text-[var(--muted)]">Select a tag above to start searching.</p>
            ) : loading ? (
              <CardSkeletonGrid count={4} />
            ) : notes.length === 0 ? (
              <p className="text-[var(--muted)]">No notes match the selected tags.</p>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {notes.map((note) => (
                  <motion.div key={note.id} variants={fadeInUp}>
                    <NoteCard
                      note={note}
                      onToggleUpvote={toggleTagUpvote}
                      onView={handleView}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
