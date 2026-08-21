import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAllowedStorageUrl } from "@/lib/storage-url";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PAGES = 24;
const CACHE_BUCKET = "flipbook-cache";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function cacheKeyFor(fileUrl: string): string {
  return `${createHash("sha256").update(fileUrl).digest("hex")}.json`;
}

async function readCache(cacheKey: string): Promise<{ pages: string[]; totalPages: number } | null> {
  try {
    const {
      data: { publicUrl },
    } = supabase.storage.from(CACHE_BUCKET).getPublicUrl(cacheKey);
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const cached = await res.json();
    return Array.isArray(cached?.pages) && cached.pages.length > 0 ? cached : null;
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string, payload: { pages: string[]; totalPages: number }) {
  try {
    await supabase.storage.from(CACHE_BUCKET).upload(cacheKey, JSON.stringify(payload), {
      contentType: "application/json",
      upsert: true,
    });
  } catch (err) {
    // Caching is a nice-to-have — a failed write shouldn't fail the request
    // that already did the expensive rendering work.
    console.error("Flipbook cache write failed:", err);
  }
}

// Renders a PDF's pages as images so the 3D flipbook viewer has something
// to flip through — notes are stored as the original PDF, this just gives
// the client a page-by-page image strip on demand. Rendering is CPU-heavy
// (tens of seconds for large/image-heavy PDFs), so the result is cached:
// only the first person to open a given note's flipbook pays that cost.
export async function POST(request: Request) {
  const { fileUrl } = await request.json();
  if (typeof fileUrl !== "string" || !isAllowedStorageUrl(fileUrl)) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }

  const cacheKey = cacheKeyFor(fileUrl);
  const cached = await readCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
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
    // all. Sequential is the correct approach here.
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const dataUrl = await renderPageAsImage(pdf, pageNum, {
        scale: 1.0,
        toDataURL: true,
        canvasImport: () => import("@napi-rs/canvas"),
      });
      pages.push(dataUrl);
    }

    const payload = { pages, totalPages: pdf.numPages };
    await writeCache(cacheKey, payload);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Page rendering failed:", err);
    return NextResponse.json({ error: "Failed to render pages" }, { status: 500 });
  }
}
