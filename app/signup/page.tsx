"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/Card";
import OAuthButtons from "@/components/OAuthButtons";
import { PerspectiveBackground } from "@/components/originkit/ui/hero-03/perspective-background";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/browse");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-[calc(100vh-73px)] items-center justify-center overflow-hidden px-6 py-12">
      <div className="absolute inset-0 -z-10">
        <PerspectiveBackground />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, rotateX: -8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{ perspective: 1000 }}
        className="relative z-10 w-full max-w-sm"
      >
        <Card className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Sign up
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create your Notes Repo account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Sign up"}
            </motion.button>
          </form>

          <div className="mt-6">
            <OAuthButtons />
          </div>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
              Log in
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
