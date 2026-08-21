import { NextResponse } from "next/server";
import { isAllowedStorageUrl } from "@/lib/storage-url";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 24;

// Renders a PDF's pages as images so the 3D flipbook viewer has something
// to flip through — notes are stored as the original PDF, this just gives
// the client a page-by-page image strip on demand.
export async function POST(request: Request) {
  const { fileUrl } = await request.json();
  if (typeof fileUrl !== "string" || !isAllowedStorageUrl(fileUrl)) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
    }
    const arrayBuffer = await response.arrayBuffer();
    const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);

    // Pages are independent, so rendering them concurrently instead of one
    // at a time cuts wall-clock time roughly in proportion to page count —
    // the difference between a multi-page PDF taking one page's worth of
    // time vs. N pages' worth.
    const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);
    const pages = await Promise.all(
      pageNumbers.map((pageNum) =>
        renderPageAsImage(pdf, pageNum, {
          scale: 1.4,
          toDataURL: true,
          canvasImport: () => import("@napi-rs/canvas"),
        })
      )
    );

    return NextResponse.json({ pages, totalPages: pdf.numPages });
  } catch (err) {
    console.error("Page rendering failed:", err);
    return NextResponse.json({ error: "Failed to render pages" }, { status: 500 });
  }
}
