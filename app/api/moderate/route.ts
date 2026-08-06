import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TEXT_MODEL = "llama-3.3-70b-versatile";
const VISION_MODEL = "gemini-flash-latest";

const TEXT_SYSTEM_PROMPT = `You are a content moderation classifier for a college study-notes sharing site. Given the text below (a note's title, description, and/or extracted document text), decide whether it contains: sexually explicit / 18+ content, profanity or slurs, hate speech, or harassment. Respond ONLY with strict JSON: {"flagged": boolean, "reason": string}. "reason" should be a short (under 15 words) explanation, or an empty string if not flagged.`;

const VISION_SYSTEM_PROMPT = `You are a content moderation classifier for a college study-notes sharing site. Look at the image(s) provided and decide whether any of them show sexually explicit / 18+ content, graphic violence, or other content inappropriate for a classroom setting. Respond ONLY with strict JSON: {"flagged": boolean, "reason": string}. "reason" should be a short (under 15 words) explanation, or an empty string if not flagged.`;

type ModerationResult = { flagged: boolean; reason: string };

// unpdf bundles a serverless-friendly build of pdf.js (no web worker, no
// browser-only globals like DOMMatrix), which is what makes PDF text
// extraction actually work in a Vercel serverless function.
async function extractPdfText(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return "";
    const arrayBuffer = await response.arrayBuffer();
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.slice(0, 6000);
  } catch (err) {
    console.error("PDF text extraction failed:", err);
    return "";
  }
}

// mammoth only reads the modern .docx (Open XML) format — legacy binary
// .doc files have no good lightweight JS parser, so those still fall back
// to title/description only.
async function extractDocxText(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return "";
    const arrayBuffer = await response.arrayBuffer();
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(arrayBuffer),
    });
    return value.slice(0, 6000);
  } catch (err) {
    console.error("DOCX text extraction failed:", err);
    return "";
  }
}

// A scanned/photographed set of notes saved as a PDF has no real text
// layer — each page is just an image. Render the first few pages so they
// can go through the vision check instead of silently skipping moderation.
async function renderPdfPagesAsImages(fileUrl: string, maxPages = 3): Promise<string[]> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return [];
    const arrayBuffer = await response.arrayBuffer();
    const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
    const pageCount = Math.min(pdf.numPages, maxPages);

    const images: string[] = [];
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const dataUrl = await renderPageAsImage(pdf, pageNum, {
        scale: 1.5,
        toDataURL: true,
        canvasImport: () => import("@napi-rs/canvas"),
      });
      images.push(dataUrl);
    }
    return images;
  } catch (err) {
    console.error("PDF page rendering failed:", err);
    return [];
  }
}

async function checkText(text: string, apiKey: string): Promise<ModerationResult> {
  if (!text.trim()) return { flagged: false, reason: "" };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: TEXT_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Groq text moderation failed:", await response.text());
      return { flagged: false, reason: "" };
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      flagged: Boolean(parsed.flagged),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch (err) {
    console.error("Text moderation failed:", err);
    return { flagged: false, reason: "" };
  }
}

async function toInlineImage(
  url: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return null;
      return { mimeType: match[1], data: match[2] };
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") ?? "image/png";
    const data = Buffer.from(arrayBuffer).toString("base64");
    return { mimeType, data };
  } catch (err) {
    console.error("Failed to load image for vision check:", err);
    return null;
  }
}

// Groq doesn't currently offer a vision-capable model, so image content
// (raw PNG/JPG uploads, and scanned-PDF pages rendered as images) is
// checked with Gemini instead — the only place vision moderation happens.
async function checkImages(imageUrls: string[], apiKey: string): Promise<ModerationResult> {
  if (imageUrls.length === 0) return { flagged: false, reason: "" };

  try {
    const images = (
      await Promise.all(imageUrls.slice(0, 3).map(toInlineImage))
    ).filter((img): img is { mimeType: string; data: string } => img !== null);
    if (images.length === 0) return { flagged: false, reason: "" };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${VISION_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: VISION_SYSTEM_PROMPT },
                ...images.map((img) => ({
                  inline_data: { mime_type: img.mimeType, data: img.data },
                })),
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        }),
      }
    );

    if (!response.ok) {
      console.error("Gemini vision moderation failed:", await response.text());
      return { flagged: false, reason: "" };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const parsed = JSON.parse(text);
    return {
      flagged: Boolean(parsed.flagged),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch (err) {
    console.error("Vision moderation failed:", err);
    return { flagged: false, reason: "" };
  }
}

export async function POST(request: Request) {
  const { fileUrl, fileType, title, description } = await request.json();

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) {
    return NextResponse.json({ flagged: false });
  }

  const extractedText =
    fileType === "pdf"
      ? await extractPdfText(fileUrl)
      : fileType === "docx"
        ? await extractDocxText(fileUrl)
        : "";

  const isImageFile = fileType === "png" || fileType === "jpg" || fileType === "jpeg";
  // A PDF with almost no extractable text is very likely a scanned/
  // photographed document rather than a real text document — treat it
  // like an image so it still gets visually checked.
  const isLikelyScannedPdf = fileType === "pdf" && extractedText.trim().length < 40;

  const imageUrlsToCheck: string[] = [];
  if (isImageFile) {
    imageUrlsToCheck.push(fileUrl);
  } else if (isLikelyScannedPdf) {
    imageUrlsToCheck.push(...(await renderPdfPagesAsImages(fileUrl)));
  }

  const textToCheck = [title, description, extractedText]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 8000);

  const [textResult, visionResult] = await Promise.all([
    groqKey ? checkText(textToCheck, groqKey) : Promise.resolve({ flagged: false, reason: "" }),
    geminiKey
      ? checkImages(imageUrlsToCheck, geminiKey)
      : Promise.resolve({ flagged: false, reason: "" }),
  ]);

  const flagged = textResult.flagged || visionResult.flagged;
  const reason = [textResult.reason, visionResult.reason].filter(Boolean).join("; ");

  return NextResponse.json({ flagged, reason });
}
