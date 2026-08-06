"use client";

import { MotionConfig } from "framer-motion";
import { smoothSpring } from "@/lib/motion";

export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig transition={smoothSpring} reducedMotion="user">
      {children}
    </MotionConfig>
  );
}
