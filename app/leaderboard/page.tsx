"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getLeaderboard } from "@/lib/notes";
import Card from "@/components/Card";
import { CardSkeletonGrid } from "@/components/Skeleton";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { LeaderboardEntry } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(supabase, 10)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [supabase]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Leaderboard
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Top contributors, ranked by ratings earned across all their notes.
      </p>

      <div className="mt-8">
        {loading ? (
          <CardSkeletonGrid count={5} />
        ) : entries.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">
            No notes have been uploaded yet.
          </p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-3"
          >
            {entries.map((entry, index) => (
              <motion.div key={entry.userId} variants={fadeInUp}>
                <Card className="flex items-center gap-4 p-5">
                  <span className="w-8 text-center text-xl">
                    {MEDALS[index] ?? `#${index + 1}`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                      {entry.name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {entry.totalNotes} note{entry.totalNotes === 1 ? "" : "s"}{" "}
                      uploaded
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold text-amber-500">
                    {entry.totalUpvotes} ★
                  </span>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
