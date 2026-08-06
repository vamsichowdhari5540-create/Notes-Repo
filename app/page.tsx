"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Card from "@/components/Card";
import Hero03 from "@/components/originkit/hero-03";
import { useAuth } from "@/lib/auth-context";
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

const portals = [
  {
    title: "Log in",
    desc: "Already sharing notes with your class? Welcome back.",
    emoji: "🔑",
    href: "/login",
  },
  {
    title: "Register",
    desc: "New here? Create an account to browse and upload notes.",
    emoji: "🎓",
    href: "/signup",
  },
];

export default function Home() {
  const { user, loading } = useAuth();

  return (
    <div>
      <Hero03 />

      {!loading && !user && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24"
        >
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Get started
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Log in to your account, or register a new one to start browsing and uploading notes.
            </p>
          </motion.div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {portals.map((portal) => (
              <motion.div key={portal.title} variants={fadeInUp}>
                <Link href={portal.href}>
                  <Card
                    hover
                    className="flex h-full flex-col items-center gap-2 p-8 text-center"
                  >
                    <motion.span
                      className="text-4xl"
                      whileHover={{ scale: 1.2, rotate: 8 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, mass: 0.6 }}
                    >
                      {portal.emoji}
                    </motion.span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {portal.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {portal.desc}
                    </p>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!loading && user && (
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
      )}
    </div>
  );
}
