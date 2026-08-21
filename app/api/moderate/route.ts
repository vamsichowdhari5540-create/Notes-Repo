import { NextResponse } from "next/server";
import { isAllowedStorageUrl } from "@/lib/storage-url";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEXT_MODEL = "qwen/qwen3.6-27b";
const VISION_MODEL = "gemini-flash-latest";

const TEXT_SYSTEM_PROMPT = `You are a content moderation classifier for a college study-notes sharing site. Given the text below (a note's title, description, and/or extracted document text), decide whether it contains: sexually explicit / 18+ content, profanity or slurs, hate speech, or harassment. Respond ONLY with strict JSON: {"flagged": boolean, "reason": string}. "reason" should be a short (under 15 words) explanation, or an empty string if not flagged.`;

const VISION_SYSTEM_PROMPT = `You are looking at page image(s) from a college study-notes upload. Do two things:
1. Moderation: decide whether any image shows sexually explicit / 18+ content, graphic violence, or other content inappropriate for a classroom setting.
2. Transcription: transcribe all readable text from the image(s) as plain text, including handwriting, in reading order. If there's no readable text, use an empty string.
Respond ONLY with strict JSON: {"flagged": boolean, "reason": string, "text": string}. "reason" should be a short (under 15 words) explanation, or an empty string if not flagged.`;

type ModerationResult = { flagged: boolean; reason: string };
type VisionResult = ModerationResult & { text: string };

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
        // This is a simple classification call, not a reasoning task —
        // disable Qwen's thinking mode so it responds directly with the
        // JSON object instead of a slower step-by-step reasoning trace.
        reasoning_effort: "none",
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

type InlineImage = { mimeType: string; data: string };

function parseVisionResult(raw: string): VisionResult {
  const parsed = JSON.parse(raw);
  return {
    flagged: Boolean(parsed.flagged),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    text: typeof parsed.text === "string" ? parsed.text : "",
  };
}

async function callGeminiVision(images: InlineImage[], apiKey: string): Promise<VisionResult> {
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
  if (!response.ok) throw new Error(`Gemini vision failed: ${await response.text()}`);

  const data = await response.json();
  return parseVisionResult(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}");
}

// Qwen3.6 27B (via Groq) supports image input too, so it doubles as a
// fallback vision model when Gemini is unavailable or rate-limited —
// avoids the whole upload pipeline going unmoderated just because one
// provider's free-tier quota ran out.
async function callQwenVision(images: InlineImage[], apiKey: string): Promise<VisionResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      temperature: 0,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_SYSTEM_PROMPT },
            ...images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType};base64,${img.data}` },
            })),
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Qwen vision failed: ${await response.text()}`);

  const data = await response.json();
  return parseVisionResult(data.choices?.[0]?.message?.content ?? "{}");
}

// Tries Gemini first (generally stronger vision quality), falling back to
// Qwen on Groq if Gemini errors or hits its rate limit, so a single
// provider's outage/quota doesn't leave image uploads unmoderated. This
// also transcribes any readable/handwritten text so scanned notes are
// searchable, not just typed ones.
async function checkImages(
  imageUrls: string[],
  geminiKey: string | undefined,
  groqKey: string | undefined
): Promise<VisionResult> {
  if (imageUrls.length === 0) return { flagged: false, reason: "", text: "" };

  const images = (
    await Promise.all(imageUrls.slice(0, 3).map(toInlineImage))
  ).filter((img): img is InlineImage => img !== null);
  if (images.length === 0) return { flagged: false, reason: "", text: "" };

  if (geminiKey) {
    try {
      return await callGeminiVision(images, geminiKey);
    } catch (err) {
      console.error("Gemini vision failed, falling back to Qwen:", err);
    }
  }

  if (groqKey) {
    try {
      return await callQwenVision(images, groqKey);
    } catch (err) {
      console.error("Qwen vision fallback also failed:", err);
    }
  }

  return { flagged: false, reason: "", text: "" };
}

export async function POST(request: Request) {
  const { fileUrl, fileType, title, description } = await request.json();

  if (typeof fileUrl !== "string" || !isAllowedStorageUrl(fileUrl)) {
    return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
  }

  // Extracted regardless of whether moderation keys are set — the upload
  // flow persists this as searchable note content either way.
  const extractedText =
    fileType === "pdf"
      ? await extractPdfText(fileUrl)
      : fileType === "docx"
        ? await extractDocxText(fileUrl)
        : "";

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!groqKey && !geminiKey) {
    console.warn(
      "Content moderation is disabled: no GROQ_API_KEY or GEMINI_API_KEY set."
    );
    return NextResponse.json({ flagged: false, extractedText });
  }

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
    geminiKey || groqKey
      ? checkImages(imageUrlsToCheck, geminiKey, groqKey)
      : Promise.resolve({ flagged: false, reason: "", text: "" }),
  ]);

  const flagged = textResult.flagged || visionResult.flagged;
  const reason = [textResult.reason, visionResult.reason].filter(Boolean).join("; ");
  const fullExtractedText = [extractedText, visionResult.text]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  return NextResponse.json({ flagged, reason, extractedText: fullExtractedText });
}
