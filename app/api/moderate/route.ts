import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isAllowedStorageUrl } from "@/lib/storage-url";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reuses the flipbook's page-render cache bucket (0015_flipbook_cache.sql)
// with a distinct key suffix so scanned-PDF moderation checks don't pay to
// re-render the same pages every time — a "-moderate" suffix keeps this
// separate from the flipbook viewer's own cache entries for the same file,
// since the two render at different scales/page counts.
const CACHE_BUCKET = "flipbook-cache";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function moderationCacheKeyFor(fileUrl: string): string {
  return `${createHash("sha256").update(fileUrl).digest("hex")}-moderate.json`;
}

async function readPageCache(cacheKey: string): Promise<string[] | null> {
  try {
    const {
      data: { publicUrl },
    } = supabase.storage.from(CACHE_BUCKET).getPublicUrl(cacheKey);
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const cached = await res.json();
    return Array.isArray(cached?.images) && cached.images.length > 0 ? cached.images : null;
  } catch {
    return null;
  }
}

async function writePageCache(cacheKey: string, images: string[]) {
  try {
    await supabase.storage.from(CACHE_BUCKET).upload(cacheKey, JSON.stringify({ images }), {
      contentType: "application/json",
      upsert: true,
    });
  } catch (err) {
    console.error("Moderation page-render cache write failed:", err);
  }
}

const TEXT_MODEL = "qwen/qwen3.6-27b";
const VISION_MODEL = "gemini-flash-latest";

// "category" distinguishes *why* an upload was rejected so the UI can give
// actionable feedback instead of one generic "flagged" message:
// - "content": a real policy violation (explicit/hateful/harassing material)
// - "relevance": not flagged for safety, but clearly not academic content
// - "quality": image is too blurry/dark/incomplete to be usable
type FlagCategory = "content" | "relevance" | "quality" | null;

const TEXT_SYSTEM_PROMPT = `You are reviewing text for a college study-notes sharing site (a note's title, description, and/or extracted/transcribed document text). Do two checks:
1. Moderation: does it contain sexually explicit / 18+ content, profanity or slurs, hate speech, or harassment?
2. Relevance: is this genuinely academic/study material, or is it clearly unrelated spam, an ad, or non-academic content someone uploaded by mistake?
Respond ONLY with strict JSON: {"flagged": boolean, "category": "content" | "relevance" | null, "reason": string}. "category" is null when not flagged. "reason" is a short (under 15 words) explanation, or an empty string if not flagged.`;

const VISION_SYSTEM_PROMPT = `You are looking at page image(s) from a college study-notes upload. Do three things:
1. Moderation: does any image show sexually explicit / 18+ content, graphic violence, or other content inappropriate for a classroom setting?
2. Quality: is the image too blurry, too dark, or too incomplete/cut-off to actually be usable as study material? (Normal handwriting or scan imperfections are fine — only flag genuinely unreadable images.)
3. Transcription: transcribe all readable text from the image(s) as plain text, including handwriting, in reading order. If there's no readable text, use an empty string.
Respond ONLY with strict JSON: {"flagged": boolean, "category": "content" | "quality" | null, "reason": string, "text": string}. "category" is null when not flagged. "reason" is a short (under 15 words) explanation, or an empty string if not flagged.`;

const ANALYZE_SYSTEM_PROMPT = `You are analyzing the text of a college study-notes upload (title plus its content). Do three things:
1. Write a 2-sentence summary of what this note covers.
2. Suggest 3-6 short topic tags (lowercase, no punctuation, a student would search for) describing the content.
3. If the text mentions a specific unit or chapter number (e.g. "Unit 3", "UNIT - I", "Chapter 5"), extract just that number as "unit" — otherwise null.
Respond ONLY with strict JSON: {"summary": string, "tags": string[], "unit": number | null}.`;

type ModerationResult = { flagged: boolean; category: FlagCategory; reason: string };
type VisionResult = ModerationResult & { text: string };
type AnalyzeResult = { summary: string; tags: string[]; unit: number | null };

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
// Rendering is the expensive part (seconds per page), so the result is
// cached per file — repeat moderation checks on the same upload (retries,
// re-runs) reuse it instead of re-rendering from scratch.
async function renderPdfPagesAsImages(fileUrl: string, maxPages = 3): Promise<string[]> {
  const cacheKey = moderationCacheKeyFor(fileUrl);
  const cached = await readPageCache(cacheKey);
  if (cached) return cached;

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

    if (images.length > 0) await writePageCache(cacheKey, images);
    return images;
  } catch (err) {
    console.error("PDF page rendering failed:", err);
    return [];
  }
}

function parseCategory(raw: unknown): FlagCategory {
  return raw === "content" || raw === "relevance" || raw === "quality" ? raw : null;
}

async function checkText(text: string, apiKey: string): Promise<ModerationResult> {
  if (!text.trim()) return { flagged: false, category: null, reason: "" };

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
      return { flagged: false, category: null, reason: "" };
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      flagged: Boolean(parsed.flagged),
      category: parseCategory(parsed.category),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch (err) {
    console.error("Text moderation failed:", err);
    return { flagged: false, category: null, reason: "" };
  }
}

async function analyzeContent(
  text: string,
  title: string,
  apiKey: string
): Promise<AnalyzeResult> {
  const empty: AnalyzeResult = { summary: "", tags: [], unit: null };
  const input = [title, text].filter(Boolean).join("\n\n").slice(0, 8000);
  if (!input.trim()) return empty;

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
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYZE_SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Content analysis failed:", await response.text());
      return empty;
    }

    const data = await response.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 500) : "",
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 6)
        : [],
      unit: Number.isInteger(parsed.unit) ? parsed.unit : null,
    };
  } catch (err) {
    console.error("Content analysis failed:", err);
    return empty;
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
    category: parseCategory(parsed.category),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
    text: typeof parsed.text === "string" ? parsed.text : "",
  };
}

// Gemini has no client-side timeout by default, and under real load it can
// take 20+ seconds to respond even when it's about to fail (observed
// directly: a 503 "high demand" error that itself took 22s to arrive).
// Without a hard cutoff here, a struggling Gemini eats most of the
// function's time budget before the Qwen fallback ever gets a chance to
// run. 15s is generous for a normal response but short enough to leave
// real room for the fallback afterward.
const GEMINI_TIMEOUT_MS = 15000;

async function callGeminiVision(images: InlineImage[], apiKey: string): Promise<VisionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(
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
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
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
  if (imageUrls.length === 0) return { flagged: false, category: null, reason: "", text: "" };

  const images = (
    await Promise.all(imageUrls.slice(0, 3).map(toInlineImage))
  ).filter((img): img is InlineImage => img !== null);
  if (images.length === 0) return { flagged: false, category: null, reason: "", text: "" };

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

  return { flagged: false, category: null, reason: "", text: "" };
}

export async function POST(request: Request) {
  // This route drives paid AI calls (Groq/Gemini) and PDF rendering, and is
  // only ever called from the authenticated upload/edit flows — reject
  // anyone else so it can't be hit directly as a free cost-abuse target.
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    // aiVerified stays false here on purpose — no real check ran, so the
    // upload shouldn't claim an "AI-Verified" badge it didn't earn.
    return NextResponse.json({
      flagged: false,
      category: null,
      reason: "",
      extractedText,
      summary: "",
      tags: [],
      unit: null,
      aiVerified: false,
    });
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
    groqKey
      ? checkText(textToCheck, groqKey)
      : Promise.resolve({ flagged: false, category: null, reason: "" } as ModerationResult),
    geminiKey || groqKey
      ? checkImages(imageUrlsToCheck, geminiKey, groqKey)
      : Promise.resolve({ flagged: false, category: null, reason: "", text: "" } as VisionResult),
  ]);

  const flagged = textResult.flagged || visionResult.flagged;
  // Vision's category (e.g. a blurry scan) is the more specific/actionable
  // signal when both fire — prefer it over text's.
  const category = visionResult.category ?? textResult.category;
  const reason = [textResult.reason, visionResult.reason].filter(Boolean).join("; ");
  const fullExtractedText = [extractedText, visionResult.text]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000);

  // Summary/tags/unit are only worth generating for content that actually
  // made it through moderation — no point analyzing something rejected.
  const analysis =
    !flagged && groqKey
      ? await analyzeContent(fullExtractedText, title ?? "", groqKey)
      : { summary: "", tags: [], unit: null };

  return NextResponse.json({
    flagged,
    category,
    reason,
    extractedText: fullExtractedText,
    summary: analysis.summary,
    tags: analysis.tags,
    unit: analysis.unit,
    aiVerified: true,
  });
}
