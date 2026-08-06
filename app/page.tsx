"use client";

import { motion } from "framer-motion";
import Card from "@/components/Card";
import Hero03 from "@/components/originkit/hero-03";
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
    <div>
      <Hero03 />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 px-6 py-16 sm:grid-cols-3 sm:py-24"
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
    </div>
  );
}
