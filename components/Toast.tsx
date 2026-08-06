"use client";

import { motion } from "framer-motion";

export default function Toast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 180, damping: 24, mass: 0.7 }}
      className="fixed bottom-6 right-6 z-50 rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-xl"
    >
      {message}
    </motion.div>
  );
}
