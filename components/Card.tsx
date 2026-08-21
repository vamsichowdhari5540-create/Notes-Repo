"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type CardProps = Omit<HTMLMotionProps<"div">, "children"> & {
  hover?: boolean;
  children?: React.ReactNode;
};

export default function Card({
  hover = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -6 } : undefined}
      transition={{ type: "spring", stiffness: 260, damping: 24, mass: 0.6 }}
      className={`rounded-[28px] border-2 bg-white shadow-xl shadow-slate-900/10 transition-colors duration-200 dark:bg-slate-900/80 dark:shadow-black/30 dark:backdrop-blur-xl ${
        hover
          ? "border-slate-200/80 hover:border-amber-400 dark:border-white/10 dark:hover:border-amber-400/60"
          : "border-slate-200/80 dark:border-white/10"
      } ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
