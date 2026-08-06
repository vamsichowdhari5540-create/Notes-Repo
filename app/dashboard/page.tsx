"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  deleteNote,
  getNotesForUser,
  getRecentlyViewed,
} from "@/lib/notes";
import { CardSkeletonGrid } from "@/components/Skeleton";
import NoteCard from "@/components/NoteCard";
import Card from "@/components/Card";
import Toast from "@/components/Toast";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { NoteWithMeta, Profile, RecentlyViewedNote } from "@/lib/types";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState<NoteWithMeta[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [branch, setBranch] = useState("");
  const [year, setYear] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const [{ data: profileData }, notesData, recentlyViewedData] =
        await Promise.all([
          supabase
            .from("users")
            .select("id, name, email, branch, year")
            .eq("id", user!.id)
            .single(),
          getNotesForUser(supabase, user!.id),
          getRecentlyViewed(supabase, user!.id, 5).catch(() => []),
        ]);
      setProfile(profileData ?? null);
      setBranch(profileData?.branch ?? "");
      setYear(profileData?.year ? String(profileData.year) : "");
      setNotes(notesData);
      setRecentlyViewed(recentlyViewedData);
      setLoading(false);
    }

    load();
  }, [user, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function toggleUpvote(noteId: string) {
    if (!user) return;

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

  async function handleDeleteNote(noteId: string) {
    await deleteNote(supabase, noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setToast("Note deleted.");
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSavingProfile(true);

    const { data, error } = await supabase
      .from("users")
      .update({
        branch: branch.trim() || null,
        year: year.trim() ? Number(year) : null,
      })
      .eq("id", user.id)
      .select("id, name, email, branch, year")
      .single();

    setSavingProfile(false);

    if (!error && data) {
      setProfile(data);
      setToast("Profile updated!");
    }
  }

  const totalNotes = notes.length;
  const totalRatings = notes.reduce((sum, n) => sum + n.upvote_count, 0);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <Card className="p-10">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Log in to see your dashboard
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Track your uploads and ratings once you&apos;re signed in.
          </p>
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="mt-6 inline-block"
          >
            <Link
              href="/login"
              className="inline-block rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25"
            >
              Log in
            </Link>
          </motion.div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        My Dashboard
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Your profile, uploads, and rating stats.
      </p>

      {loading ? (
        <div className="mt-8">
          <CardSkeletonGrid count={3} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Profile
              </h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Name</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {profile?.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Email</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100">
                    {profile?.email}
                  </dd>
                </div>
              </dl>

              <form onSubmit={handleSaveProfile} className="mt-5 flex flex-col gap-3 border-t border-white/20 pt-5 dark:border-white/10">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Branch
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="e.g. CSE"
                    className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Year
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2"
                    className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={savingProfile}
                  className="mt-1 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
                >
                  {savingProfile ? "Saving…" : "Save profile"}
                </motion.button>
              </form>
            </Card>

            <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-rows-1">
              <Card className="flex flex-col items-center justify-center p-6 text-center">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {totalNotes}
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Notes uploaded
                </span>
              </Card>
              <Card className="flex flex-col items-center justify-center p-6 text-center">
                <span className="text-3xl font-bold text-amber-500">
                  {totalRatings} ★
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Total ratings received
                </span>
              </Card>
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              My uploads
            </h2>

            <div className="mt-4">
              {notes.length === 0 ? (
                <Card className="flex flex-col items-center gap-3 p-12 text-center">
                  <p className="text-slate-600 dark:text-slate-400">
                    You haven&apos;t uploaded any notes yet.
                  </p>
                  <Link
                    href="/upload"
                    className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25"
                  >
                    Upload a note
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
                        isOwner
                        onDelete={handleDeleteNote}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {recentlyViewed.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Recently viewed
              </h2>
              <div className="mt-4 flex flex-col gap-2">
                {recentlyViewed.map((item) => (
                  <Link key={item.noteId} href={`/units/${item.unitId}`}>
                    <Card
                      hover
                      className="flex items-center justify-between p-4"
                    >
                      <span className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(item.viewedAt).toLocaleDateString()}
                      </span>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
