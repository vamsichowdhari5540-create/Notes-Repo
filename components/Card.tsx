"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cardHover } from "@/lib/motion";

type CardProps = HTMLMotionProps<"div"> & {
  hover?: boolean;
};

export default function Card({
  hover = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial="rest"
      whileHover={hover ? "hover" : undefined}
      variants={hover ? cardHover : undefined}
      style={{ perspective: 1000 }}
      className={`rounded-2xl border border-white/40 bg-white/60 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
