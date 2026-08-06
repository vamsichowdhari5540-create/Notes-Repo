// Delivered by Originkit · stack: nextjs · styling: tailwind
"use client";

import { useRouter } from "next/navigation";
import { HeroContent } from "@/components/originkit/ui/hero-03/hero-content";
import { PerspectiveBackground } from "@/components/originkit/ui/hero-03/perspective-background";

export const Section12Hero = () => {
  const router = useRouter();

  return (
    <section
      aria-label="Notes Repo hero"
      className="relative isolate w-full overflow-hidden bg-[#fafaf9] dark:bg-[#0b1120]"
    >
      <div className="relative mx-auto flex h-screen w-full max-w-[1600px] flex-col wide-lg:max-w-none">
        <PerspectiveBackground />

        <div className="pointer-events-none relative z-20 flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-6 ipad:px-12 desktop-sm:px-6 desktop-sm:pb-20 desktop-sm:pt-6">
          <HeroContent
            onExplore={() => router.push("/browse")}
            onUpload={() => router.push("/upload")}
          />
        </div>
      </div>
    </section>
  );
};
