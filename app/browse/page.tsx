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

export default function BrowsePage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("subjects")
      .select("id, name, code, branch, semester")
      .order("name")
      .then(({ data }) => {
        setSubjects(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Browse subjects
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Pick a subject to see its units and uploaded notes.
      </p>

      <div className="mt-8">
        {loading ? (
          <CardSkeletonGrid count={4} />
        ) : subjects.length === 0 ? (
          <p className="text-[var(--muted)]">No subjects have been added yet.</p>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {subjects.map((subject) => (
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
                    {(subject.branch || subject.semester) && (
                      <p className="mt-3 text-xs font-medium text-[var(--accent)]">
                        {[
                          subject.branch,
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
