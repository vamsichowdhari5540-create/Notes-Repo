"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Card from "@/components/Card";
import { fadeInUp, staggerContainer } from "@/lib/motion";

const features = [
  {
    title: "Browse",
    desc: "Explore subjects and units, organized the way your syllabus is.",
    emoji: "📚",
  },
  {
    title: "Upload",
    desc: "Share your notes in seconds — drag, drop, tag, done.",
    emoji: "📤",
  },
  {
    title: "Search",
    desc: "Find exactly what you need, ranked by tag relevance.",
    emoji: "🔍",
  },
];

export default function Home() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-6xl flex-col items-center gap-16 px-6 py-24 text-center sm:py-32"
    >
      <motion.div variants={fadeInUp} style={{ perspective: 1000 }}>
        <motion.h1
          initial={{ rotateX: -15, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="bg-gradient-to-br from-teal-600 via-indigo-600 to-violet-600 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl dark:from-teal-400 dark:via-indigo-400 dark:to-violet-400"
        >
          Notes Repo
        </motion.h1>
        <p className="mx-auto mt-4 max-w-md text-slate-600 dark:text-slate-400">
          A shared space for browsing, uploading, and searching class notes by
          subject, unit, and tag.
        </p>

        <motion.div
          variants={fadeInUp}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/browse"
              className="rounded-xl bg-gradient-to-r from-teal-600 via-indigo-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25"
            >
              Browse notes
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/upload"
              className="rounded-xl border border-white/40 bg-white/60 px-6 py-3 text-sm font-semibold text-slate-700 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              Upload notes
            </Link>
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        className="grid w-full grid-cols-1 gap-5 sm:grid-cols-3"
      >
        {features.map((feature) => (
          <motion.div key={feature.title} variants={fadeInUp}>
            <Card
              hover
              className="flex h-full flex-col items-center gap-2 p-6 text-center"
            >
              <motion.span
                className="text-3xl"
                whileHover={{ scale: 1.2, rotate: 8 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.6 }}
              >
                {feature.emoji}
              </motion.span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {feature.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {feature.desc}
              </p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
