"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getNotesForUnit, recordNoteView } from "@/lib/notes";
import { CardSkeletonGrid } from "@/components/Skeleton";
import NoteCard from "@/components/NoteCard";
import Card from "@/components/Card";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { NoteWithMeta, Unit } from "@/lib/types";

type SortOption = "upvotes" | "recent";

export default function UnitNotesPage() {
  const params = useParams<{ unitId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [notes, setNotes] = useState<NoteWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("upvotes");

  const loadNotes = useCallback(
    async (sort: SortOption) => {
      const data = await getNotesForUnit(
        supabase,
        params.unitId,
        user?.id ?? null,
        sort
      );
      setNotes(data);
    },
    [supabase, params.unitId, user?.id]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: unitData }] = await Promise.all([
        supabase
          .from("units")
          .select("id, subject_id, unit_number, title")
          .eq("id", params.unitId)
          .single(),
        loadNotes(sortBy),
      ]);
      setUnit(unitData ?? null);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.unitId, user?.id, sortBy]);

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

    // Optimistic update — the trigger-backed count is re-synced right after.
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

    const { error } = note.upvoted_by_me
      ? await supabase
          .from("upvotes")
          .delete()
          .eq("note_id", noteId)
          .eq("user_id", user.id)
      : await supabase.from("upvotes").insert({ note_id: noteId, user_id: user.id });

    if (error) {
      console.error("Toggle upvote failed:", error);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? note : n)));
      return;
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

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {unit && (
        <Link
          href={`/browse/${unit.subject_id}`}
          className="text-sm font-medium text-[var(--accent)] hover:underline"
        >
          ← Back to units
        </Link>
      )}

      {loading ? (
        <div className="mt-6">
          <div className="h-7 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-8">
            <CardSkeletonGrid count={4} />
          </div>
        </div>
      ) : !unit ? (
        <p className="mt-6 text-[var(--muted)]">Unit not found.</p>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                Unit {unit.unit_number}
              </p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                {unit.title}
              </h1>
            </div>

            {notes.length > 0 && (
              <div className="flex gap-1 rounded-lg border border-white/40 bg-white/60 p-1 text-sm shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <button
                  onClick={() => setSortBy("upvotes")}
                  className={`relative rounded-md px-3 py-1 font-medium transition-colors ${
                    sortBy === "upvotes"
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {sortBy === "upvotes" && (
                    <motion.span
                      layoutId="sort-pill"
                      className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-white/10"
                      transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.6 }}
                    />
                  )}
                  <span className="relative">Top</span>
                </button>
                <button
                  onClick={() => setSortBy("recent")}
                  className={`relative rounded-md px-3 py-1 font-medium transition-colors ${
                    sortBy === "recent"
                      ? "text-slate-900 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {sortBy === "recent" && (
                    <motion.span
                      layoutId="sort-pill"
                      className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-white/10"
                      transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.6 }}
                    />
                  )}
                  <span className="relative">Most recent</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-8">
            {notes.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-[var(--muted)]">
                  No notes have been uploaded for this unit yet.
                </p>
                <Link
                  href={`/upload?unit=${unit.id}`}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25"
                >
                  Upload the first note
                </Link>
              </Card>
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
        </>
      )}
    </div>
  );
}
