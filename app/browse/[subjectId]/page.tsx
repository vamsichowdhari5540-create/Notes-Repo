"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { CardSkeletonGrid } from "@/components/Skeleton";
import Card from "@/components/Card";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import type { Subject, Unit } from "@/lib/types";

export default function SubjectUnitsPage() {
  const params = useParams<{ subjectId: string }>();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const [{ data: subjectData }, { data: unitsData }] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name, code, branch, semester, year")
          .eq("id", params.subjectId)
          .single(),
        supabase
          .from("units")
          .select("id, subject_id, unit_number, title")
          .eq("subject_id", params.subjectId)
          .order("unit_number"),
      ]);
      setSubject(subjectData ?? null);
      setUnits(unitsData ?? []);
      setLoading(false);
    }

    load();
  }, [params.subjectId]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <Link
        href="/browse"
        className="text-sm font-medium text-[var(--accent)] hover:underline"
      >
        ← All subjects
      </Link>

      {loading ? (
        <div className="mt-6">
          <div className="h-7 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-8">
            <CardSkeletonGrid count={3} />
          </div>
        </div>
      ) : !subject ? (
        <p className="mt-6 text-[var(--muted)]">Subject not found.</p>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {subject.name}
          </h1>
          <p className="mt-1 text-[var(--muted)]">{subject.code}</p>

          <div className="mt-8">
            {units.length === 0 ? (
              <p className="text-[var(--muted)]">No units have been added yet.</p>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-3"
              >
                {units.map((unit) => (
                  <motion.div key={unit.id} variants={fadeInUp}>
                    <Link href={`/units/${unit.id}`}>
                      <Card hover className="flex items-center justify-between p-5">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                            Unit {unit.unit_number}
                          </p>
                          <h2 className="mt-0.5 text-base font-semibold">
                            {unit.title}
                          </h2>
                        </div>
                        <span className="text-[var(--muted)]">→</span>
                      </Card>
                    </Link>
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
