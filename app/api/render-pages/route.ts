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

    // Rendering pages concurrently was tried and made things worse: this is
    // CPU-bound native rasterization (@napi-rs/canvas), not I/O — running
    // many at once on a single-vCPU serverless function causes memory/CPU
    // contention instead of overlap, and the request stopped completing at
    // all. Sequential is the correct approach here; the scale reduction
    // below is what actually cuts per-page render time.
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const dataUrl = await renderPageAsImage(pdf, pageNum, {
        scale: 1.4,
        toDataURL: true,
        canvasImport: () => import("@napi-rs/canvas"),
      });
      pages.push(dataUrl);
    }

    return NextResponse.json({ pages, totalPages: pdf.numPages });
  } catch (err) {
    console.error("Page rendering failed:", err);
    return NextResponse.json({ error: "Failed to render pages" }, { status: 500 });
  }
}
