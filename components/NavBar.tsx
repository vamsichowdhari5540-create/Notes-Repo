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
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/40 bg-white/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="bg-gradient-to-r from-teal-600 via-indigo-600 to-violet-600 bg-clip-text text-lg font-semibold tracking-tight text-transparent"
        >
          Notes Repo
        </Link>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-8">
          {navLinks.map((link) => (
            <li key={link.href}>
              <motion.div whileHover="hover" initial="rest" className="relative">
                <Link
                  href={link.href}
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-indigo-600 dark:text-slate-300"
                >
                  {link.label}
                </Link>
                <motion.span
                  variants={{
                    rest: { scaleX: 0 },
                    hover: { scaleX: 1 },
                  }}
                  transition={{ duration: 0.2 }}
                  style={{ originX: 0 }}
                  className="absolute -bottom-1 left-0 h-px w-full bg-gradient-to-r from-teal-500 via-indigo-500 to-violet-500"
                />
              </motion.div>
            </li>
          ))}
          {!loading && (
            <li className="flex items-center gap-3 border-l border-slate-300/50 pl-3 sm:gap-4 sm:pl-6 dark:border-white/10">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="hidden text-sm font-medium text-slate-700 hover:text-indigo-600 sm:inline dark:text-slate-300"
                  >
                    {user.user_metadata?.name ?? user.email}
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={handleLogout}
                    className="rounded-lg bg-slate-900/5 px-3 py-1.5 text-sm font-medium text-slate-700 backdrop-blur transition-colors hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                  >
                    Log out
                  </motion.button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300"
                  >
                    Log in
                  </Link>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                    <Link
                      href="/signup"
                      className="rounded-lg bg-gradient-to-r from-teal-600 via-indigo-600 to-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-indigo-600/20"
                    >
                      Sign up
                    </Link>
                  </motion.div>
                </>
              )}
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
