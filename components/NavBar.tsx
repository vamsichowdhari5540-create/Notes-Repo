"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";

const navLinks = [
  { href: "/browse", label: "Browse" },
  { href: "/search", label: "Search" },
  { href: "/upload", label: "Upload" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function NavBar() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-4 shadow-sm backdrop-blur-xl sm:px-8 dark:border-white/10 dark:bg-slate-900/70">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Link href="/" className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Notes Repo
        </Link>

        <ul className="flex flex-wrap items-center gap-1 rounded-full border-2 border-slate-100 bg-slate-50 p-1.5 sm:gap-2 dark:border-white/10 dark:bg-white/5">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-white hover:text-amber-600 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-amber-400"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {!loading && (
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="hidden text-sm font-bold text-slate-700 hover:text-amber-600 sm:inline dark:text-slate-300"
                >
                  {user.user_metadata?.name ?? user.email}
                </Link>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleLogout}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                >
                  Log out
                </motion.button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-bold text-slate-600 hover:text-amber-600 dark:text-slate-300"
                >
                  Log in
                </Link>
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  <Link
                    href="/signup"
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/25"
                  >
                    Sign up
                  </Link>
                </motion.div>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
