"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CardSkeletonGrid } from "@/components/Skeleton";
import Card from "@/components/Card";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { Subject } from "@/lib/types";

const YEAR_LABELS: Record<number, string> = {
  1: "First Year",
  2: "Second Year",
  3: "Third Year",
  4: "Final Year",
};
const YEARS = [1, 2, 3, 4];
const BRANCHES = ["CSE", "CSE-AI", "CSE-AIML", "CSE-IOT", "ECE", "EEE"];

export default function BrowsePage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedBranch, setSelectedBranch] = useState<string | "all">("all");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("subjects")
      .select("id, name, code, branch, semester, year")
      .order("name")
      .then(({ data }) => {
        setSubjects(data ?? []);
        setLoading(false);
      });
  }, []);

  const visibleSubjects = subjects.filter(
    (subject) =>
      (selectedYear === "all" || subject.year === selectedYear) &&
      (selectedBranch === "all" || subject.branch === selectedBranch)
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Browse subjects
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Pick a subject to see its units and uploaded notes.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedYear("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selectedYear === "all"
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/25"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          }`}
        >
          All years
        </button>
        {YEARS.map((year) => (
          <button
            key={year}
            type="button"
            onClick={() => setSelectedYear(year)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedYear === year
                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
            }`}
          >
            {YEAR_LABELS[year]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSelectedBranch("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            selectedBranch === "all"
              ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          }`}
        >
          All branches
        </button>
        {BRANCHES.map((branch) => (
          <button
            key={branch}
            type="button"
            onClick={() => setSelectedBranch(branch)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              selectedBranch === branch
                ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
            }`}
          >
            {branch}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading ? (
          <CardSkeletonGrid count={4} />
        ) : visibleSubjects.length === 0 ? (
          <p className="text-[var(--muted)]">
            {subjects.length === 0
              ? "No subjects have been added yet."
              : "No subjects match these filters yet."}
          </p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visibleSubjects.map((subject) => (
              <motion.div key={subject.id} variants={fadeInUp}>
                <Link href={user ? `/browse/${subject.id}` : "/signup"}>
                  <Card hover className="p-5">
                    <div
                      aria-hidden
                      className="mb-3 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_3px_rgba(251,191,36,0.6)]"
                    />
                    <h2 className="text-base font-semibold">{subject.name}</h2>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {subject.code}
                    </p>
                    {(subject.branch || subject.semester || subject.year) && (
                      <p className="mt-3 text-xs font-medium text-[var(--accent)]">
                        {[
                          subject.branch,
                          subject.year && YEAR_LABELS[subject.year],
                          subject.semester && `Sem ${subject.semester}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </Card>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
