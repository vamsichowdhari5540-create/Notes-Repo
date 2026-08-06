"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { recordNoteView, searchNotesByTags } from "@/lib/notes";
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

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<NoteWithMeta[]>([]);
  const [loading, setLoading] = useState(false);

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

  async function toggleUpvote(noteId: string) {
    if (!user) {
      router.push("/login");
      return;
    }

    const note = notes.find((n) => n.id === noteId);
    if (!note) return;

    setNotes((prev) =>
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

    if (note.upvoted_by_me) {
      await supabase
        .from("upvotes")
        .delete()
        .eq("note_id", noteId)
        .eq("user_id", user.id);
    } else {
      await supabase.from("upvotes").insert({ note_id: noteId, user_id: user.id });
    }

    const { data } = await supabase
      .from("notes")
      .select("upvote_count")
      .eq("id", noteId)
      .single();
    if (data) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, upvote_count: data.upvote_count } : n
        )
      );
    }
  }

  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Search by tag</h1>
      <p className="mt-2 text-[var(--muted)]">
        Pick one or more tags — notes matching the most tags show up first.
      </p>

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
                  className="flex items-center gap-1 rounded-full bg-teal-500/15 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-400"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    className="text-teal-500 hover:text-teal-700"
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
            className="w-full rounded-xl border border-white/40 bg-white/60 px-4 py-2.5 text-sm text-slate-900 shadow-lg shadow-slate-900/5 backdrop-blur-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
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
                  onToggleUpvote={toggleUpvote}
                  onView={handleView}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
