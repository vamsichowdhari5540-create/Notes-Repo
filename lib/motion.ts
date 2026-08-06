import type { Variants } from "framer-motion";

// A gentle "ease-out-expo"-like curve — smoother, less abrupt than the
// default easeOut, so reveals settle rather than snap into place.
const smoothEase = [0.22, 1, 0.36, 1] as const;

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: smoothEase } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.08 },
  },
};

export const cardHover: Variants = {
  rest: { y: 0, rotateX: 0, scale: 1 },
  hover: {
    y: -6,
    rotateX: 4,
    scale: 1.015,
    transition: { type: "spring", stiffness: 180, damping: 22, mass: 0.6 },
  },
};

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.3, ease: smoothEase },
  },
};

// Shared spring config for hover/tap micro-interactions (buttons, chips,
// icons) — softer than a snappy UI spring so motion feels fluid, not bouncy.
export const smoothSpring = {
  type: "spring",
  stiffness: 200,
  damping: 24,
  mass: 0.7,
} as const;
