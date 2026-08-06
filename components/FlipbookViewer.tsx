"use client";

import { forwardRef, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

const Page = forwardRef<HTMLDivElement, { image: string; pageNumber: number }>(
  function Page({ image, pageNumber }, ref) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center bg-slate-950 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={`Page ${pageNumber}`}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }
);

export default function FlipbookViewer({ pages }: { pages: string[] }) {
  const [currentPage, setCurrentPage] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);

  const handleFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="rounded-3xl p-4 sm:p-8"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(245,158,11,0.1), transparent 70%)",
          boxShadow:
            "0 0 0 1px rgba(245,158,11,0.15), 0 20px 60px rgba(15,23,42,0.12), 0 0 80px rgba(249,115,22,0.12)",
        }}
      >
        <HTMLFlipBook
          ref={bookRef}
          width={380}
          height={520}
          size="stretch"
          minWidth={280}
          maxWidth={520}
          minHeight={380}
          maxHeight={720}
          maxShadowOpacity={0.6}
          showCover={false}
          mobileScrollSupport
          className="flipbook"
          style={{}}
          startPage={0}
          drawShadow
          flippingTime={700}
          usePortrait
          startZIndex={0}
          autoSize
          clickEventForward
          useMouseEvents
          swipeDistance={30}
          showPageCorners
          disableFlipByClick={false}
          onFlip={handleFlip}
        >
          {pages.map((image, i) => (
            <Page key={i} image={image} pageNumber={i + 1} />
          ))}
        </HTMLFlipBook>
      </div>

      <div className="flex items-center gap-4 rounded-full border-2 border-slate-200/80 bg-white px-5 py-2 shadow-lg shadow-slate-900/10">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => bookRef.current?.pageFlip().flipPrev()}
          disabled={currentPage === 0}
          className="text-lg font-bold text-amber-600 disabled:opacity-30"
          aria-label="Previous page"
        >
          ‹
        </motion.button>
        <span className="min-w-[70px] text-center text-sm font-bold text-slate-600">
          {currentPage + 1} / {pages.length}
        </span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => bookRef.current?.pageFlip().flipNext()}
          disabled={currentPage >= pages.length - 1}
          className="text-lg font-bold text-amber-600 disabled:opacity-30"
          aria-label="Next page"
        >
          ›
        </motion.button>
      </div>
    </div>
  );
}
