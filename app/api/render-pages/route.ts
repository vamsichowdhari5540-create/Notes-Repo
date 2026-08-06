import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_PAGES = 24;

// Renders a PDF's pages as images so the 3D flipbook viewer has something
// to flip through — notes are stored as the original PDF, this just gives
// the client a page-by-page image strip on demand.
export async function POST(request: Request) {
  const { fileUrl } = await request.json();
  if (typeof fileUrl !== "string") {
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

    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const dataUrl = await renderPageAsImage(pdf, pageNum, {
        scale: 1.8,
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
